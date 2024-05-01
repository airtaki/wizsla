import "dotenv/config";
import config from "config";
import { createClient  } from "redis";
import { CronJob } from "cron";
const SolarCalc = require("solar-calc");

const job = CronJob.from({
	cronTime: '* * * * * *',
	onTick: function () {
		console.log('You will see this message every second');
	},
	start: true,
	timeZone: 'America/Los_Angeles'
});

const lat = config.get("latitude");
const lon = config.get("longitude");

const solar = new SolarCalc(new Date(), lat, lon);
console.log({
  now: new Date(),
  firstLight: solar.civilDawn,
  sunrise: solar.sunrise,
  solarNoon: solar.solarNoon,
  sunset: solar.sunset,
  lastLight: solar.civilDusk,
  lunarDistance: solar.lunarDistance
});

const client = createClient();
client
  .on("connect", () => {
    console.log("Connected to Redis...");
  }).connect();

process.on("exit", function () {
  client.quit();
});
