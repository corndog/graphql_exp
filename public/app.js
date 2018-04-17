// hacked together somewhat hurriedly  :)
let org_id; // active org id
let repos = []; // list of things to display
let internal_contributors = [];
let active_data = 'repos'; // default

const clear = () => {
	document.getElementById('message').innerText = '';
	document.getElementById('data_table').innerHTML = '';
	document.getElementById('radio_buttons').style.display = 'none'; // FIX THIS MESSY LOGIC!!!
};


const sortDataBy = (activeData, field) => {
	activeData.sort((a, b) => { 
		let av = a[field];
		let bv = b[field];
		if (typeof av == "string") {
			return bv.localeCompare(av);
		}
		else {
			return bv - av; // numbers
		}

	});
};

const showData = (sortField) => {
	let data = active_data == 'repos' ? repos : internal_contributors;
	document.getElementById('message').innerText = '';
	document.getElementById('radio_buttons').style.display = ''; // FIX THIS MESSY LOGIC!!!
	sortDataBy(data, sortField);
	let keys = Object.keys(data[0]);
	let tds = row => keys.map(k => `<td>${row[k]}</td>`).join('')
	let tr = row => `<tr>${tds(row)}</tr>`
	let ths = '<tr>' + keys.map(k => `<th>${k}</th>`).join('')  + '</tr>';
	let data_rows = data.map(row => tr(row)).join('');
	let tableHTML = `<table>${ths}${data_rows}</table>`;
	document.getElementById('data_table').innerHTML = tableHTML;
};

const waitForData = async () => {
	//console.log('wait for data');
	let resp = await fetch(`/org/${org_id}`, {'method' : 'POST'}); // might take a while
	let jsd = await resp.json();
	repos = jsd.repos;
	internal_contributors = jsd.internalContributors;
	showData('name');
};



// ********** event handlers **************

// form submission
const onSubmit = async event => {
	clear();
	event.preventDefault();
	let el = document.getElementById('org_name');
	let org_name = el.value;
	let resp = await fetch(`/org/${org_name}`);
	let jsd = await resp.json();
	if (jsd.message == undefined) { // should be good to go
		repos = jsd.repos;
		internal_contributors = jsd.internalContributors;
		showData('name');
	}
	else if (jsd.message) {
		//console.log("got intial data for " + jsd.org_id);
		document.getElementById('message').innerText = jsd.message;
		org_id = jsd.org_id;
		waitForData();
	}
};

// click the ths for sorting
const clickHeader = async event => {
	let clickedEl = event.target;
	//console.log(clickedEl.tagName);
	if (clickedEl.tagName == "TH") {
		let field = clickedEl.innerText;
		showData(field); // toggle back and forth ???
	}
};

// click a radio button
const toggleTable = (event) => {
	let selectedData = document.querySelector('input[name="view_type"]:checked').value;
	console.log("SELELCTED " + selectedData);
	active_data = selectedData;
	showData('name'); 
};

// attach event handlers
document.getElementById('org_form').addEventListener('submit', onSubmit, false);

document.getElementById('data_table').addEventListener('click', clickHeader, false);

let radios = document.querySelectorAll('input[name="view_type"]');

Array.prototype.forEach.call(radios, function(radio) { radio.addEventListener('change', toggleTable, false)});