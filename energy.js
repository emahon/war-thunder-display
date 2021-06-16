// globals
let data = [];
let state = [];

let g = 9.8; // constant for gravity, TODO: What does Gaijin actually use?

let indicatorsNumRequests = 0;
// get indicators
setInterval(function () {
  if (indicatorsNumRequests < 100) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    indicatorsNumRequests++;
    fetch("http://localhost:8111/indicators", {signal})
      .then(response => response.json())
      .then(json => {
        data = json;
        // my code
        
        calc_energy(data, state);
        indicatorsNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        indicatorsNumRequests--;
      });
  }
}, 100);

let stateNumRequests = 0;
// get state
setInterval(function () {
  if (stateNumRequests < 100) {
    const abortController = new AbortController();
    const signal = abortController.signal;
    stateNumRequests++;
    fetch("http://localhost:8111/state", {signal})
      .then(response => response.json())
      .then(json => {
       state = json;
       
       // my code
       calc_energy(data, state);
       stateNumRequests--;
      })
      .catch(error => {
        abortController.abort();
        console.log(error);
        stateNumRequests--;
      });
  }
}, 100);

function calc_energy(data, state) {
  let energy_speed = (data.speed**2/2);
  let energy_height = (g*state["H, m"]);
  let energy = energy_speed + energy_height;
  document.getElementById("energy_speed").innerText = (energy_speed.toFixed(0));
  document.getElementById("energy_height").innerText = (energy_height.toFixed(0));
  document.getElementById("energy").innerText = (energy.toFixed(0));
}