const sqlite = require('sqlite-async');
const server = require('server');
const fetch = require('node-fetch');
const parseLink = require('parse-link-header');

const {get, post} = server.router;
const {render, json, redirect, status} = server.reply;
const rootUrl = 'https://api.github.com';
const opts = {
	'headers': {
		'Authorization': 'bearer xxx',
		'content-type': 'application/json'
	}
};

let db; // initialized at app startup

// create tables for orgs, repos, contributors (public and otherwise...)
const initDb = () => db.transaction(db => {
	return Promise.all([
		db.run('CREATE TABLE orgs(id INTEGER PRIMARY KEY, login TEXT)'),
		db.run('CREATE TABLE repos(id INTEGER PRIMARY KEY, name TEXT, stars INTEGER, forks INTEGER, org_id INTEGER, UNIQUE(id, org_id))'),
		db.run('CREATE TABLE users(id INTEGER PRIMARY KEY, login TEXT)'),
		db.run('CREATE TABLE repo_contributors(repo_id INTEGER, user_id INTEGER, contributions INTEGER, UNIQUE(repo_id, user_id))'),
		db.run('CREATE TABLE org_public_members(org_id INTEGER, user_id INTEGER, UNIQUE(org_id, user_id))')
	]);
});


const insertOrgPublicMembers = async (org_id, members) => {
	//  (org_id, user_id)
	let stmt = await db.prepare('INSERT OR IGNORE INTO org_public_members (org_id, user_id) VALUES (?, ?)');
	return db.transaction(db => 
		Promise.all(members.map(member => stmt.run(org_id, member.user_id)))
	);
};

const insertRepoContributors = async repoContributors => {
	// (repo_id, user_id, contributions) 
	let stmt = await db.prepare('INSERT INTO repo_contributors (repo_id, user_id, contributions) VALUES (?, ?, ?)');
	return db.transaction(db =>
		Promise.all(repoContibutors.map(rc => stmt.run(rc.repo_id, rc.user_id, rc.contributions)))
	);
};

const insertOrg = async (id, login) => {
	let stmt = await db.prepare('INSERT INTO orgs (id, login) VALUES (?, ?)');
	return stmt.run(id, login);
};

const selectOrg = async id => {
	let query = `SELECT id, login FROM orgs WHERE id = ?`;
	let row = await db.get(query, [id]);
	return row ? {id: row.id, login: row.login} : {};
};

const insertRepos = async (org_id, repos) => {
	// (id, name, stars, forks)
	let stmt = await db.prepare('INSERT INTO repos (id, name, stars, forks, org_id) VALUES (?, ?, ?, ?, ?)');
	return db.transaction( db =>
		Promise.all(repos.map(repo => stmt.run(repo.id, repo.name, repo.stars, repo.forks, org_id)))
	);
};

const selectReposForOrg = async org_id => {
	let stmt = await db.prepare(`SELECT id, name, stars, forks FROM repos WHERE org_id = ?`);
	let stmt1 = await stmt.bind(org_id);
	let rows = await stmt1.all();
	return rows.map(r => {return {id: r.id, name: r.name, stars: r.stars, forks: r.forks}});
}

const insertUsers = async users => {
	let stmt = await db.prepare('INSERT  OR IGNORE INTO users (id, login) VALUES (?,?)');
	return db.transaction(db => Promise.all(users.map(user => stmt.run(user.id, user.login))));
};

const selectUsers = async () => {
	let stmt = await db.prepare('SELECT * from users');
	let rows = await stmt.all();
	return rows.map(r => { return {id: r.id, login: r.login}});
};

// quick hack, should be in DB
// {org : {scraping: true, completed: false, max_repos: 200, max_members: 100}}  eg.
const scrapeStatuses = new Map();



// returns [link, data]
// where link has {next: .., prev: .., last: ..}
const getPaginatedData = async url => {
	let resp = await fetch(url, opts);
	let data = await resp.json();
	let link = parseLink(resp.headers.get('Link'));
	console.log(JSON.stringify(link)); // .next, .prev. , .last..
	return [link, data];
};

// const getAllPaginated = async url => {
// 	let [link, data] = await getPaginatedData(url);

// }

const getOrg = async org => {
	let url = `${rootUrl}/orgs/${org}`;
	let resp = await fetch(url, opts);
	let data = await resp.json();
	return {id: data.id, login: data.login};
};

const getPublicMembersForOrg = async (org_id, publicMembersUrl) => {
	console.log("fetching " + publicMembersUrl);
	let [link, members] = await getPaginatedData(publicMembersUrl);
	let _1 = await insertUsers(members.map(m => {return {id: m.id, login: m.login}}));
	let _2 = insertOrgPublicMembers(org_id, members.map(m => {return {user_id: m.id}}));
	if (link.next) {
		return getPublicMembersForOrg(org_id, link.next.url);
	}
	else {
		console.log("finished loading members for " + publicMembersUrl);
		return;
	}
};

const getReposForOrg = async (org_id, orgReposUrl) => {
	let [link, repos] = await getPaginatedData(orgReposUrl);
	let _1 = await insertRepos(org_id, repos.map(r => {return {id: r.id, name: r.name, stars: r.stargazers_count, forks: r.forks_count}}));
	let repoContributorsUrls = repos.map(r => r.contributors_url); // TODO
	if (link.next) {
		return getReposForOrg(org_id, link.next.url);
	}
	else {
		console.log("finished loading repos for " + orgReposUrl);
	}
};
// const getRepoContributors = async contribUrl => {
// 	let [link, data] = await getPaginatedData(`${rootUrl}/repos/${org}/${repo}/contributors`)




// TODO handle not found orgs
const fetchOrg = async ctx => {
	console.log("fetch org " + ctx.data);
	let org = await getOrg(ctx.data.org); // await getReposForOrg(ctx.data.org));
	//console.log("NEXT:\n" + link.next.page + ", " + link.next.url + ", " + link.next.per_page + ", " + link.next.rel);
	console.log("\ninserting ORG: " + org.id);
	let _1 = await insertOrg(org.id, org.login);
	let _2 = await getPublicMembersForOrg(org.id, `${rootUrl}/orgs/${org.login}/public_members`);
	let _3 = await getReposForOrg(org.id, `${rootUrl}/orgs/${org.login}/repos`);
	return redirect(`/org/${org.id}`);
	// return json(repos.map(repo => { return {
	// 	'name': repo.name,
	// 	'stars': repo.stargazers_count,
	// 	'forks': repo.forks_count,
	// 	'contributors_url': repo.contributors_url
	// }}));
};

const showOrg = async ctx => {
	let org = await selectOrg(ctx.params.id);
	//let users = await selectUsers();
	let repos = await selectReposForOrg(org.id);
	if (org.login)
		return render('org.hbs', { org: org, repos: repos });
	else
		return status(404);
};

const run = async () => {
	console.log("STARTING");
	db = await sqlite.open(':memory:');
	let _ = await initDb();
	console.log("Should have a db");

// finally set up server
	server({ security: { csrf: false } },[
		get('/', ctx => render('index.html')),
		get('/org/:id', showOrg), // login instead of id?
		post('/org', fetchOrg),
		get('/test', ctx => "Helloo!!")
	]);
};

run();

