const sqlite = require('sqlite-async');
const server = require('server');
const fetch = require('node-fetch');
const parseLink = require('parse-link-header');

const {get, post} = server.router;
const {render, json, redirect, status} = server.reply;
const rootUrl = 'https://api.github.com';
const opts = {
	'headers': {
		'Authorization': 'bearer 72bfe56c54917929960dac5d6b2056b5eaf8ce6c',
		'content-type': 'application/json'
	}
};

let db; // argh

// set up database, 
// const db = new sqlite.Database(':memory:', err => {
// 	if (err) {
// 		return console.log(err.message);
// 	}
// 	console.log("connected to DB");
// });

// INSERT OR IGNORE INTO bookmarks(users_id, lessoninfo_id) VALUES(123, 456)

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


const insertOrgPublicMember = data => {
	//  (org_id, user_id)
	let stmt = db.prepare('INSERT INTO org_public_members (org_id, user_id) VALUES (?, ?)');
	data.each((org_id, user_id) => stmt.run(org_id, user_id));
	stmt.finalize();
};

const insertRepoContributor = (repo_id, user_id, contributions) => {
	let stmt = db.prepare('INSERT INTO repo_contributors (repo_id, user_id, contributions) VALUES (?, ?, ?)');
	stmt.run(repo_id, user_id, contributions);
	stmt.finalize();
};

const insertOrg = async (id, login) => {
	console.log("INSERT ORG: " + login);
	let stmt = await db.prepare('INSERT INTO orgs (id, login) VALUES (?, ?)');
	return stmt.run(id, login);
};

const selectOrg = async id => {
	let query = `SELECT id, login FROM orgs WHERE id = ?`;
	let row = await db.get(query, [id]);
	console.log("DB ROW : " + row.login);
	return row ? {id: row.id, login: row.login} : {};
};

const insertRepos = repos => {
	// (id, name, stars, forks, org_id)
	let stmt = db.prepare('INSERT INTO repos (id, name, stars, forks, org_id)');
	repos.each((id, name, stars, forks, org_id) => stmt.run(id, name, stars, forks, org_id));
	stmt.finalize();
};

const insertUsers = async users => {
	let stmt = await db.prepare('INSERT INTO users (id, login) VALUES (?,?)');
	return db.transaction(db => Promise.all(users.map(user => stmt.run(user.id, user.login))));
};

const selectUsers = async () => {
	let stmt = await db.prepare('SELECT * from users');
	let rows = await stmt.all();
	return rows.map(r => { return {id: r.id, login: r.login}});
}

// quick hack, should be in DB
// {org : {scraping: true, completed: false, max_repos: 200, max_members: 100}}  eg.
const scrapeStatuses = new Map();

const scrape = org => {
	scrape_public_members(org);
	scrape_repos(org);
	console.log(`scraping ${org}`);
}

// returns [link, data]
// where link has {next: .., prev: .., last: ..}
const getPaginatedData = async url => {
	let resp = await fetch(url, opts);
	let data = await resp.json();
	let link = parseLink(resp.headers.get('Link'));
	console.log(JSON.stringify(link)); // .next, .prev. , .last..
	return [link, data];
}

// const getAllPaginated = async url => {
// 	let [link, data] = await getPaginatedData(url);

// }

const getOrg = async org => {
	let url = `${rootUrl}/orgs/${org}`;
	let resp = await fetch(url, opts);
	let data = await resp.json();
	return {id: data.id, login: data.login};
}

const getReposForOrg = org => getPaginatedData(`${rootUrl}/orgs/${org}/repos`)

const getPublicMembersForOrg = async publicMembersUrl => {
	console.log("fetching " + publicMembersUrl);
	let [link, members] = await getPaginatedData(publicMembersUrl);
	let _ = await insertUsers(members.map(m => {return {id: m.id, login: m.login}}));
	if (link.next) {
		return getPublicMembersForOrg(link.next.url);
	}
	else {
		console.log("finished loading members for " + publicMembersUrl);
		return;
	}
};
	
// const getRepoContributors = async contribUrl => {
// 	let [link, data] = await getPaginatedData(`${rootUrl}/repos/${org}/${repo}/contributors`)

// };


// TODO handle not found orgs
const fetchOrg = async ctx => {
	console.log("fetch org " + ctx.data);
	let org = await getOrg(ctx.data.org); // await getReposForOrg(ctx.data.org));
	//console.log("NEXT:\n" + link.next.page + ", " + link.next.url + ", " + link.next.per_page + ", " + link.next.rel);
	console.log("\ninserting ORG: " + org.id);
	let _1 = await insertOrg(org.id, org.login);
	let _2 = await getPublicMembersForOrg(`${rootUrl}/orgs/${org.login}/public_members`);
	return redirect(`/org/${org.id}`);
	// return json(repos.map(repo => { return {
	// 	'name': repo.name,
	// 	'stars': repo.stargazers_count,
	// 	'forks': repo.forks_count,
	// 	'contributors_url': repo.contributors_url
	// }}));
};

const showOrg = async ctx => {
	let data = await selectOrg(ctx.params.id);
	let users = await selectUsers();
	if (data.login)
		return render('org.hbs', { org: data, users: users });
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
		get('/org/:id', showOrg),
		post('/org', fetchOrg),
		get('/test', ctx => "Helloo!!")
	]);
};

run();

