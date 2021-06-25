// globals
let data = [];
let state = [];

let mapInfoArray = [];
let speedArray = [];
let altArray = [];
let energyArray = [];

let g = 9.8; // constant for gravity, TODO: What does Gaijin actually use?

let requestInterval = 250; // time between requests (ms)
let timeoutInterval = 1000; // when to abort a request due to timeout (ms)

// make number formatting object for performance reasons
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
let numberFormat = new Intl.NumberFormat("en-US", { minimumSignificantDigits: 5, maximumSignificantDigits: 5 });

// chart stuff
// smoothiecharts.org
let totEnergySeries = new TimeSeries();
let spdEnergySeries = new TimeSeries();
let altEnergySeries = new TimeSeries();

let indicatorsNumRequests = 0;
let indicatorRequestNum = 0;
let indicatorResettable = 0;
setInterval(() => { indicatorResettable = 0 }, timeoutInterval * 10);
// get indicators
setInterval(function () {
  if (indicatorsNumRequests < 3) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    indicatorsNumRequests++;
    indicatorResettable++;
    let inRequestNum = indicatorRequestNum++;
    const timeout = setTimeout(() => {abortController.abort()}, timeoutInterval);
    
    fetch("http://localhost:8111/indicators", {signal})
      .then(response => response.json())
      .then(json => {
        data = json;
        // my code
        
        speedArray[inRequestNum] = data.speed;
        
        calc_energy();
        display_power();
        indicatorsNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        indicatorsNumRequests--;
      });
  }
}, requestInterval);

let stateNumRequests = 0;
let stateRequestNum = 0;
let stateResettable = 0;
setInterval(() => { stateResettable = 0}, timeoutInterval * 10);
// get state
setInterval(function () {
  if (stateNumRequests < 3) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    stateNumRequests++;
    stateResettable++;
    let stateRequestNumLocal = stateRequestNum++;
    const timeout = setTimeout(() => {abortController.abort()}, timeoutInterval);
    
    fetch("http://localhost:8111/state", {signal})
      .then(response => response.json())
      .then(json => {
       state = json;
       
       // my code
       
       altArray[stateRequestNumLocal] = state["H, m"];
       calc_energy();
       display_power();
       stateNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        stateNumRequests--;
      });
  }
}, requestInterval);

let mapNumRequests = 0;
let mapRequestNum = 0;
let mapResettable = 0;
setInterval(() => {mapResettable = 0}, timeoutInterval*10);
setInterval(function() {
  let mapRequestNumLocal = mapRequestNum++;
  
  if (mapNumRequests < 3) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    mapNumRequests++;
    mapResettable++;
    const timeout = setTimeout(() => {abortController.abort()}, timeoutInterval);
    
    fetch("http://localhost:8111/map_info.json", {signal})
      .then(response => response.json())
      .then(json => {
        mapInfoArray[mapRequestNumLocal] = json;
        mapNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        mapNumRequests--;
      });
  }
}, requestInterval)

function calc_energy() {
  if (stateResettable !== indicatorResettable) {
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
  
  let time = new Date().getTime();
  
  totEnergySeries.append(time, energy);
  spdEnergySeries.append(time, energy_speed);
  altEnergySeries.append(time, energy_height);
}

function chart_energy() {
  var chartData = google.visualization.arrayToDataTable([
    ["Request #", "Total Energy"],
  ]);
}

function display_power() {
  if (stateResettable !== indicatorResettable) {
    // only update when both speed and altitude are on same step
    return;
  }
  
  let powerInst = "";
  let power2sec = "";
  let power10sec = "";
  let power60sec = "";
  let power600sec = "";
  
  if (speedArray.length >= 1) {
    powerInst = calc_power(.25);
  }
  
  if (speedArray.length >= 8) {
    power2sec = calc_power(2);
  }
  
  if (speedArray.length >= 40) {
    power10sec = calc_power(10);
  }
  
  if (speedArray.length >= 240) {
    power60sec = calc_power(60);
  }
  
  if (speedArray.length >= 2400) {
    power600sec = calc_power(600);
  }
  
  document.getElementById("power-inst").innerText = numberFormat.format(powerInst);
  document.getElementById("power-2").innerText = numberFormat.format(power2sec);
  document.getElementById("power-10").innerText = numberFormat.format(power10sec);
  document.getElementById("power-60").innerText = numberFormat.format(power60sec);
  document.getElementById("power-600").innerText = numberFormat.format(power600sec);
}

function calc_power(time) {
  let prevStep = time / .25; // time needs to be in seconds
  //if (mapInfoArray[mapInfoArray.length - 1] != mapInfoArray[mapInfoArray.length - 1 - prevStep]) {
  //  // diff map I think?????
  //  console.log(mapInfoArray[mapInfoArray.length - 1]);
  //  console.log(mapInfoArray[mapInfoArray.length - 1 - prevStep]);
  //  return null;
  //}
  
  let finalEnergy = energyArray[energyArray.length - 1];
  let initialEnergy = energyArray[energyArray.length - 1 - prevStep];
  let deltaEnergy = finalEnergy - initialEnergy;
  let power = deltaEnergy/time;
  return power;
}

function calc_chart_y(range) {
  let maxEnergy = Math.max(totEnergySeries.maxValue, spdEnergySeries.maxValue, altEnergySeries.maxValue);
  let minEnergy = Math.min(totEnergySeries.minValue, spdEnergySeries.minValue, altEnergySeries.minValue);
  
  // put a 10% margin on either side so all lines are visible
  let diff = Math.abs(maxEnergy - minEnergy);
  
  let min = Math.min((minEnergy - diff*.1),0);
  let max = Math.max((maxEnergy + diff*.1),0);
  
  return {min: min, max: max};
}

function onLoad() {
  // internal dimensions of chart never update
  // so by setting the milliseconds per pixel based on original size
  // even if the screen resizes it'll still show the right time period
  
  // this includes padding and margin... is that a problem?
  let initialWidth = document.getElementById("chart").offsetWidth;
  
  let smoothie = new SmoothieChart({
    interpolation:'linear',
    yRangeFunction: calc_chart_y,
    grid:{sharpLines:true,millisPerLine:10000,verticalSections:0},
    responsive:true,
    title: {
        text: "E (J/kg)"
      },
    millisPerPixel: 60000/initialWidth // 60000 = 60 seconds
   });
  
  smoothie.streamTo(document.getElementById("chart"), 250); // delay by 1 tick
  smoothie.addTimeSeries(totEnergySeries, { lineWidth: 1, strokeStyle: 'rgb(255,255,255)'});
  smoothie.addTimeSeries(spdEnergySeries, { lineWidth: 1, strokeStyle: 'rgb(234,146,23)' });
  smoothie.addTimeSeries(altEnergySeries, { lineWidth: 1, strokeStyle: 'rgb(0,128,255)' });
}

window.onload = onLoad;