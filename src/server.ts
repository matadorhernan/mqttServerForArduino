import { connect } from "mqtt";
import * as five from "johnny-five";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";

const client = connect("tcp://broker.hivemq.com");
const board = new five.Board();

let motorLeds: any;
let heaterLeds: any;
let coolerLeds: any;

let maxTemp: number = 15;
let minTemp: number = 8;
let maxTemp$: BehaviorSubject<number> = new BehaviorSubject(15);
let minTemp$: BehaviorSubject<number> = new BehaviorSubject(8);
let currentTemp$: BehaviorSubject<number> = new BehaviorSubject(null);

client.on("connect", () => {
  //string true false
  client.subscribe("tempApp/connected");

  //string on off
  client.subscribe("tempApp/motorState");
  client.subscribe("tempApp/coolerState");
  client.subscribe("tempApp/heaterState");

  //string only numeric chars
  client.subscribe("tempApp/maxTemp");
  client.subscribe("tempApp/minTemp");
  client.subscribe("tempApp/currentReading");

  //publish we are connected to the broker and start motor
  client.publish("tempApp/connected", "true");
  client.publish("tempApp/motorState", "on");
});

//handle temperature change
currentTemp$
  .pipe(
    filter((value) => {
      return value != null;
    })
  )
  .subscribe((filteredValue) => {
    //if we need to cool and report
    client.publish(
      "tempApp/coolerState",
      filteredValue >= maxTemp ? "on" : "off"
    );

    //if we need to heat and report
    client.publish(
      "tempApp/heaterState",
      filteredValue <= minTemp ? "on" : "off"
    );

    //report reading
    client.publish("tempApp/currentReading", filteredValue.toString());
  });

maxTemp$
  .pipe(
    filter((value) => {
      return value != null;
    })
  )
  .subscribe((filteredValue) => {
    maxTemp = filteredValue;
  });

minTemp$
  .pipe(
    filter((value) => {
      return value != null;
    })
  )
  .subscribe((filteredValue) => {
    minTemp = filteredValue;
  });

client.on("message", (topic, message) => {
  //message is a buffer we convert to string, topic is already an string
  let parsedMessage = Buffer.from(message).toString();

  board.on("ready", function () {
    motorLeds = new five.Led({
      pin: 0,
    });
    heaterLeds = new five.Led({
      pin: 1,
    });
    coolerLeds = new five.Led({
      pin: 2,
    });

    switch (topic) {
      case "tempApp/connected":
        handleConnected(parsedMessage);
        break;
      case "tempApp/motorState":
        handleMotorState(parsedMessage);
        break;
      case "tempApp/coolerState":
        handleCoolerState(parsedMessage);
        break;
      case "tempApp/heaterState":
        handleHeaterState(parsedMessage);
        break;
      case "tempApp/maxTemp":
        handleMaxTempState(parsedMessage);
        break;
      case "tempApp/minTemp":
        handleMinTempState(parsedMessage);
        break;
    }
  });
});

function handleConnected(message: string): void {
  currentTemp$.next(null);
  let thermometer = new five.Thermometer({
    controller: "LM35",
    pin: "5",
    freq: 1000,
  });
  thermometer.on("data", function () {
    console.log("Current temp in C", this.C);
    currentTemp$.next(this.C);
  });
}

function handleMotorState(message: string): void {
  switch (message) {
    case "on": {
      console.log("Motor encendido");
      motorLeds.on();
      break;
    }
    case "off": {
      console.log("Motor apagado");
      motorLeds.off();
      break;
    }
  }
}

function handleCoolerState(message: string): void {
  switch (message) {
    case "on": {
      coolerLeds.on();
      break;
    }
    case "off": {
      coolerLeds.off();
      break;
    }
  }
}
function handleHeaterState(message: string): void {
  switch (message) {
    case "on": {
      heaterLeds.on();
      break;
    }
    case "off": {
      heaterLeds.off();
      break;
    }
  }
}

function handleMaxTempState(message: string): void {
  const parsedTemp = Number(message);
  maxTemp$.next(isNaN(parsedTemp) ? maxTemp : parsedTemp);
}

function handleMinTempState(message: string): void {
  const parsedTemp = Number(message);
  minTemp$.next(isNaN(parsedTemp) ? minTemp : parsedTemp);
}
