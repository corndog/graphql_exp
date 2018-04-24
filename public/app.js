// State
let repos = []; // list of things to display
let internal_contributors = [];
let external_contributors = [];
let data;
let active_data = 'repos'; 
let sort_field = 'contributions'; 
let org_name = '';

// render
// const showData = () => {
// 	setMessage('');
// 	document.getElementById('radio_buttons').style.display = '';

// 	// now deal with setting up and rendering data
// 	data = active_data == 'repos' ? repos : 
// 				active_data == 'internal_contributors' ? internal_contributors : external_contributors;
// 	console.log("active : " + data.length);
// 	sortData();
// 	let keys = Object.keys(data[0]);
// 	let tableHTML = `<table class="sortable"><tr>${keys.map(k => `<th>${k}</th>`).join("")}</tr>
// 		${data.map(row => 
// 			`<tr>${keys.map(k => `<td>${row[k]}</td>`).join()}
// 			 </tr>`
// 		).join("")}
// 	</table>`;
// 	document.getElementById('data_table').innerHTML = '';
// 	document.getElementById('data_table').innerHTML = tableHTML;
// };


const showData = () => {
	setMessage('');
	document.getElementById('radio_buttons').style.display = '';
	data = active_data == 'repos' ? repos : 
				active_data == 'internal_contributors' ? internal_contributors : external_contributors;
	sortData();
	let keys = Object.keys(data[0]);
	let tds = row => keys.map(k => `<td>${row[k]}</td>`).join('')
	let tr = row => `<tr>${tds(row)}</tr>`
	let ths = '<tr>' + keys.map(k => `<th>${k}</th>`).join('')  + '</tr>';
	let data_rows = data.map(row => tr(row)).join('');
	let tableHTML = `<table class="sortable">${ths}${data_rows}</table>`;
	document.getElementById('data_table').innerHTML = tableHTML;
};



const clear = () => {
	document.getElementById('message').innerText = '';
	document.getElementById('data_table').innerHTML = '';
	document.getElementById('radio_buttons').style.display = 'none';
	//document.getElementById('radio_repos').selected = true; // ?
};


const sortData = () => {
	data.sort((a, b) => { 
		let av = a[sort_field];
		let bv = b[sort_field];
		if (typeof av == "string") {
			return av.localeCompare(bv);
		}
		else {
			return bv - av; // numbers desc order
		}

	});
};

const setMessage = msg => {
	document.getElementById('message').innerText = msg;
};

const getData = async () => {
	// reset sort field, pick name or contributions as they are in all
	//sort_field = 'contributions';
	let resp = await fetch(`/org/${org_name}`); // might take a while
	if (resp.status == 404) {
		setMessage('NOT FOUND');
	}
	else if (! resp.ok) {
		let jsd = await resp.json();
		let err = jsd.error ? jsd.error : "unexpected server error";
		setMessage(err.message);
	}
	else if (resp.ok){
		let jsd = await resp.json();
		if (jsd.done) {
			repos = jsd.repos;
			internal_contributors = jsd.internalContributors;
			external_contributors = jsd.externalContributors
			showData();
		}
		else if (jsd.message) {
			setMessage(jsd.message);
			setTimeout(getData, 2000);
		}
		else {
			console.log("OOPS");
			setMessage("something has gone wrong");
		}
	}
	else {
		setMessage("Other error " + resp.status);
	}
};



// ********** event handlers **************

// form submission
const onSubmit = async event => {
	clear();
	//active_data = 'repos';  TODO reset radio button to repos
	event.preventDefault();
	let el = document.getElementById('org_name');
	org_name = el.value;
	getData(); 
};

// click the ths for sorting
const clickHeader = async event => {
	let clickedEl = event.target;
	if (clickedEl.tagName == "TH") {
		sort_field = clickedEl.innerText;
		console.log("sort field " + sort_field);
		showData(); // toggle back and forth ???
	}
};

// click a radio button
const toggleTable = (event) => {
	let selectedData = document.querySelector('input[name="view_type"]:checked').value;
	active_data = selectedData;
	showData(); 
};

// attach event handlers
document.getElementById('org_form').addEventListener('submit', onSubmit, false);

document.getElementById('data_table').addEventListener('click', clickHeader, false);

let radios = document.querySelectorAll('input[name="view_type"]');

Array.prototype.forEach.call(radios, function(radio) { radio.addEventListener('change', toggleTable, false)});