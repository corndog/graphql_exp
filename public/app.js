let org_id; // active org id
let data = []; // list of things to display

const clear = () => {
	document.getElementById('message').innerText = '';
	document.getElementById('data_table').innerHTML = '';
};


const sortDataBy = field => {
	data.sort((a, b) => { a[field] - b[field]
		let av = a[field];
		let bv = b[field];
		if (typeof av == "string") {
			return av.localeCompare(bv);
		}
		else {
			return av - bv; // numbers
		}

	});
};

const showData = sortField => {
	sortDataBy(sortField);
	let keys = Object.keys(data[0]);
	let tds = row => keys.map(k => `<td>${row[k]}</td>`).join('')
	let tr = row => `<tr>${tds(row)}</tr>`
	let ths = '<tr>' + keys.map(k => `<th>${k}</th>`).join('')  + '</tr>';
	let data_rows = data.map(row => tr(row)).join('');
	let tableHTML = `<table>${ths}${data_rows}</table>`;
	document.getElementById('data_table').innerHTML = tableHTML;
};

const waitForData = async () => {
	console.log('wait for data');
	let resp = await fetch(`/org/${org_id}`, {'method' : 'POST'}); // might take a while
	let jsd = await resp.json();
	showData('name');
};



// ********** event handlers **************

// form submission
const onSubmit = async event => {
	console.log('submit form');
	event.preventDefault();
	let el = document.getElementById('org_name');
	let org_name = el.value;
	let resp = await fetch(`/org/${org_name}`);
	let jsd = await resp.json();
	if (jsd.message == undefined) { // should be good to go
		// sort it??
		data = jsd;
		showData('name');
	}
	else if (jsd.message) {
		console.log("got intial data for " + jsd.org_id);
		document.getElementById('message').innerText = jsd.message;
		org_id = jsd.org_id;
		waitForData();
	}
};

// click the ths for sorting
const clickHeader = async event => {
	let clickedEl = event.target;
	console.log(clickedEl.tagName);
	if (clickedEl.tagName == "TH") {
		let field = clickedEl.innerText;
		showData(field); // toggle back and forth ???
	}
};

// attach event handlers
document.getElementById('org_form').addEventListener('submit', onSubmit, false);

document.getElementById('data_table').addEventListener('click', clickHeader, false);

