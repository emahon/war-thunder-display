// globals
let data = [];
let state = [];

let speedArray = [];
let altArray = [];
let energyArray = [];

let g = 9.8; // constant for gravity, TODO: What does Gaijin actually use?

//https://developers-dot-devsite-v2-prod.appspot.com/chart/interactive/docs/gallery/linechart.html
google.charts.load('current', {'packages': ['corechart']});
google.charts.setOnLoadCallback(chart_energy);

// make number formatting object for performance reasons
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
let numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

let indicatorsNumRequests = 0;
let indicatorRequestNum = 0;
// get indicators
setInterval(function () {
  if (indicatorsNumRequests < 100) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    indicatorsNumRequests++;
    let inRequestNum = indicatorRequestNum++;
    fetch("http://localhost:8111/indicators", {signal})
      .then(response => response.json())
      .then(json => {
        data = json;
        // my code
        
        speedArray[inRequestNum] = data.speed;
        
        calc_energy();
        indicatorsNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        indicatorsNumRequests--;
      });
  }
}, 250);

let stateNumRequests = 0;
let stateRequestNum = 0;
// get state
setInterval(function () {
  if (stateNumRequests < 100) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    stateNumRequests++;
    let stateRequestNumLocal = stateRequestNum++;
    fetch("http://localhost:8111/state", {signal})
      .then(response => response.json())
      .then(json => {
       state = json;
       
       // my code
       
       altArray[stateRequestNumLocal] = state["H, m"];
       calc_energy();
       stateNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        stateNumRequests--;
      });
  }
}, 250);

function calc_energy() {
  if (speedArray.length !== altArray.length) {
    // only update when both speed and altitude are on same step
    return;
  }
  let index = Math.min(speedArray.length, altArray.length) - 1;
  let energy_speed = (speedArray[index]**2/2);
  let energy_height = (g*altArray[index]);
  let energy = energy_speed + energy_height;
  energyArray[index] = energy;
  document.getElementById("energy_speed").innerText = numberFormat.format(energy_speed);
  document.getElementById("energy_height").innerText = numberFormat.format(energy_height);
  document.getElementById("energy").innerText = numberFormat.format(energy);
}

function chart_energy() {
  var chartData = google.visualization.arrayToDataTable([
    ["Request #", "Total Energy"],
  ]);
}

function calc_power(energy, time) {
  
}