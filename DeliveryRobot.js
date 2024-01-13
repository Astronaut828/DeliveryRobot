// Automaton Project
// A mail- delivery robot picking up and dropping off parcels in a virtual world.

// The virtual world consists of 11 places with 14 roads between them.
const roads = [
  "Alice's House-Bob's House",
  "Alice's House-Cabin",
  "Alice's House-Post Office",
  "Bob's House-Town Hall",
  "Daria's House-Ernie's House",
  "Daria's House-Town Hall",
  "Ernie's House-Grete's House",
  "Grete's House-Farm",
  "Grete's House-Shop",
  "Marketplace-Post Office",
  "Marketplace-Town Hall",
  "Marketplace-Farm",
  "Marketplace-Shop",
  "Shop-Town Hall",
];

// Convert the list of roads to a data structure that, for each place, tells us what can be reached from there.
function buildGraph(edges) {
  let graph = Object.create(null);
  function addEdge(from, to) {
    if (graph[from] == null) {
      graph[from] = [to];
    } else {
      graph[from].push(to);
    }
  }
  for (let [from, to] of edges.map((r) => r.split("-"))) {
    addEdge(from, to);
    addEdge(to, from);
  }
  return graph;
}
const roadGraph = buildGraph(roads);

// Task
/* The robot will be moving around the virtual world. 
There are parcels in various places, each addressed to some other place. 
The automaton picks up parcels when it comes to them and delivers them when it arrives at their destinations.
The robot must decide, at each point, where to go next. It has finished its task when all parcels have been delivered. */
class WorldState {
  constructor(place, parcels) {
    this.place = place;
    this.parcels = parcels;
  }

  move(destination) {
    if (!roadGraph[this.place].includes(destination)) {
      return this;
    } else {
      let parcels = this.parcels
        .map((p) => {
          if (p.place != this.place) return p;
          return { place: destination, address: p.address };
        })
        .filter((p) => p.place != p.address);
      return new WorldState(destination, parcels);
    }
  }
}

let first = new WorldState("Post Office", [
  { place: "Post Office", address: "Alice's House" },
]);

let next = first.move("Alice's House");
// console.log(next.place); // → Alice's House
// console.log(next.parcels); // → []
// console.log(first.place); // → Post Office
/* The move causes the parcel to be delivered, and this is reflected in the next state. 
But the initial state still describes the situation where the robot is at the post oﬀice and the parcel is undelivered. */

// Simulation //
/* A delivery robot looks at the world and decides in which direction it wants to move. 
The robot is a function that takes a WorldState object and returns the name of a nearby place. 
It must pick up all parcels by visiting every location that has a parcel and deliver them by visiting every location that a parcel is addressed to, 
but only after picking up the parcel.*/
function runRobot(state, robot, memory) {
  for (let turn = 0; ; turn++) {
    if (state.parcels.length == 0) {
      // console.log(`${robot.name} done in ${turn} turns`);
      return turn;
    }
    let action = robot(state, memory);
    state = state.move(action.direction);
    memory = action.memory;
    // console.log(`Moved to ${action.direction}`);
  }
}

// Random Route
/* Remember that Math.random() returns a number between zero and one—but always below one. 
Multiplying such a number by the length of an array and then applying Math.floor to it gives us a random index for the array. */
function randomPick(array) {
  let choice = Math.floor(Math.random() * array.length);
  return array[choice];
}
function randomRobot(state) {
  return { direction: randomPick(roadGraph[state.place]) };
}

WorldState.random = function (parcelCount = 5) {
  let parcels = [];
  for (let i = 0; i < parcelCount; i++) {
    let address = randomPick(Object.keys(roadGraph));
    let place;
    do {
      place = randomPick(Object.keys(roadGraph));
    } while (place == address);
    parcels.push({ place, address });
  }
  return new WorldState("Post Office", parcels);
};

// runRobot(WorldState.random(), randomRobot);

// The mail truck's route
/* If we find a route that passes all places in the village, the robot could run that route twice, 
at which point it is guaranteed to be done. Here is one such route (starting from the post office) */
const mailRoute = [
  "Alice's House",
  "Cabin",
  "Alice's House",
  "Bob's House",
  "Town Hall",
  "Daria's House",
  "Ernie's House",
  "Grete's House",
  "Shop",
  "Grete's House",
  "Farm",
  "Marketplace",
  "Post Office",
];

function routeRobot(state, memory) {
  if (memory.length == 0) {
    memory = mailRoute;
  }
  return { direction: memory[0], memory: memory.slice(1) };
}

// runRobot(WorldState.random(), routeRobot, (memory = []));

// Pathfinding
/* Finding the shortest route. Approach: “grow” routes from the starting point, 
exploring every reachable place that hasn’t been visited yet, until a route reaches the goal. */
function findRoute(graph, from, to) {
  let work = [{ at: from, route: [] }];
  for (let i = 0; i < work.length; i++) {
    let { at, route } = work[i];
    for (let place of graph[at]) {
      if (place == to) return route.concat(place);
      if (!work.some((w) => w.at == place)) {
        work.push({ at: place, route: route.concat(place) });
      }
    }
  }
}

function goalOrientedRobot({ place, parcels }, route) {
  if (route.length == 0) {
    let parcel = parcels[0];
    if (parcel.place != place) {
      route = findRoute(roadGraph, place, parcel.place);
    } else {
      route = findRoute(roadGraph, place, parcel.address);
    }
  }
  return { direction: route[0], memory: route.slice(1) };
}

// runRobot(WorldState.random(), goalOrientedRobot, (memory = []));

// Personal setup
/* Creating a robot that is intended to move more efficiently than the goalOrientedRobot. 
Breadth-First Search (BFS) algorithm */
function calculateDistance(graph, from, to) {
  let visited = new Set();
  let queue = [[from, 0]];

  while (queue.length > 0) {
    let [current, distance] = queue.shift();

    if (current === to) {
      return distance;
    }

    visited.add(current);

    for (let neighbor of graph[current]) {
      if (!visited.has(neighbor)) {
        queue.push([neighbor, distance + 1]);
      }
    }
  }

  return Infinity;
}

function findClosestParcel(currentLocation, parcels, graph) {
  let closestParcel = null;
  let shortestDistance = Infinity;

  for (let parcel of parcels) {
    let target =
      parcel.place !== currentLocation ? parcel.place : parcel.address;
    let distance = calculateDistance(graph, currentLocation, target);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestParcel = parcel;
    }
  }

  return closestParcel;
}

function quicknessRobot({ place, parcels }, route) {
  if (route.length === 0) {
    let closestParcel = findClosestParcel(place, parcels, roadGraph);
    route = findRoute(
      roadGraph,
      place,
      closestParcel.place !== place
        ? closestParcel.place
        : closestParcel.address
    );
  }
  return { direction: route[0], memory: route.slice(1) };
}

runRobot(WorldState.random(), quicknessRobot, (memory = []));

// Measuring Robot performance
// Creating 100 tasks and running them with each robot to compare them on the basis of the average number of steps they take per task.
// Insures that the robots have to work on the same tasks, and that we can compare them fairly.
function compareRobots(robot1, robot2, tasks = 100) {
  let robot1TotalTurns = 0;
  let robot2TotalTurns = 0;
  for (let i = 0; i < tasks; i++) {
    let task = WorldState.random();
    robot1TotalTurns += runRobot(task, robot1, (memory = []));
    robot2TotalTurns += runRobot(task, robot2, (memory = []));
  }
  return {
    robot1: { name: robot1.name, averageTurns: robot1TotalTurns / tasks },
    robot2: { name: robot2.name, averageTurns: robot2TotalTurns / tasks },
  };
}
let comparisonResult = compareRobots(goalOrientedRobot, quicknessRobot);
console.log(
  `${comparisonResult.robot1.name} average turns: ${comparisonResult.robot1.averageTurns} \n${comparisonResult.robot2.name} average turns: ${comparisonResult.robot2.averageTurns}`
);
