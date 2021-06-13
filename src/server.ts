import { connect } from "mqtt";
import * as five from "johnny-five";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";
const client = connect("mqtt://broker.hivemq.com");
const board = new five.Board();

let motorLeds: any;
let heaterLeds: any;
let coolerLeds: any;

let maxTemp: number = 50;
let minTemp: number = 20;
let maxTemp$: BehaviorSubject<number> = new BehaviorSubject(50);
let minTemp$: BehaviorSubject<number> = new BehaviorSubject(20);
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
      filteredValue <= maxTemp ? "on" : "off"
    );

    //report reading
    client.publish("tempApp/currentReading", filteredValue.toString());
  });

client.on("message", (topic, message) => {
  //message is a buffer we convert to string, topic is already an string
  let parsedMessage = Buffer.from(message).toString();

  board.on("ready", function () {
    motorLeds = new five.Leds(["2"]);
    heaterLeds = new five.Leds(["0", "1"]);
    coolerLeds = new five.Leds(["3"]);

    switch (topic) {
      case "tempApp/connected":
        return handleConnected(parsedMessage);
      case "tempApp/motorState":
        return handleMotorState(parsedMessage);
      case "tempApp/coolerState":
        return handleCoolerState(parsedMessage);
      case "tempApp/heaterState":
        return handleHeaterState(parsedMessage);
      case "tempApp/heaterState":
        return handleMaxTempState(parsedMessage);
      case "tempApp/heaterState":
        return handleMinTempState(parsedMessage);
    }
  });
});

function handleConnected(message: string): void {
  currentTemp$.next(null);
  let thermometer = new five.Thermometer({
    controller: "LM35",
    pin: "5",
  });
  thermometer.on("change", function () {
    console.log("Current temp in C", this.C);
    currentTemp$.next(this.C);
  });
}

function handleMotorState(message: string): void {
  switch (message) {
    case "on": {
      motorLeds.on();
    }
    case "off": {
      motorLeds.off();
    }
  }
}

function handleCoolerState(message: string): void {
  switch (message) {
    case "on": {
      coolerLeds.on();
    }
    case "off": {
      coolerLeds.off();
    }
  }
}
function handleHeaterState(message: string): void {
  switch (message) {
    case "on": {
      heaterLeds.on();
    }
    case "off": {
      heaterLeds.off();
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
