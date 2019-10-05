const express = require('express');
const {exec} = require('child_process');
const sqlite3 = require('sqlite3').verbose();

const app = express();

app.use('/', express.static('static'));

app.use(function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

function logTemperature () {
	exec('cat /sys/bus/w1/devices/28-011550329fff/w1_slave | grep "t=" | awk -F "t=" \'{print $2/1000}\'', (error, stdout, stderr) => {
		if (error) {
			console.error('exec error: ' + error);
			return;
		}
		let temperature = parseFloat(stdout);
		let db = new sqlite3.Database('./database.sqlite', (err) => {
			if (err) {
				console.error(err.message);
			}
		});
		db.serialize(() => {
			db.get("CREATE TABLE IF NOT EXISTS temperature (value INTEGER NOT NULL, logged_at INTEGER NOT NULL);", (err, row) => {
				if (err) {
					console.error(err.message);
				}
			});
			db.get("INSERT INTO temperature (value, logged_at) VALUES (" + parseInt(temperature * 1000) + ", strftime('%s', 'now'));", (err, row) => {
				if (err) {
					console.error(err.message);
				}
			});
		});
		db.close((err) => {
			if (err) {
				console.error(err.message);
  			}
		});
	});
}


app.get('/temp', (req, res) => {
	let rowsCount = 10;
	if (req.query.r) {
		const rowsCountInt = parseInt(req.query.r);
		if (!isNaN(rowsCountInt)) {
			if (rowsCountInt >= 1 && rowsCountInt <= 10080) {
				rowsCount = parseInt(req.query.r);
			} else {
				res.status(400).send("Parameter 'r' must be between 1 and 10000");
				return;
			}
		} else {
			res.status(400).send("Parameter 'r' is not an Integer");
			return;
		}
	}

	let db = new sqlite3.Database('./database.sqlite', (err) => {
		if (err) {
			console.error(err.message);
		}
	});
	db.serialize(() => {
		db.all("SELECT value, logged_at FROM temperature LIMIT " + rowsCount + " OFFSET (SELECT COUNT(*) FROM temperature)-" + rowsCount + ";", (err, rows) => {
			if (err) {
				console.error(err.message);
			}
			res.send(rows);
		});
	});
	db.close((err) => {
		if (err) {
			console.error(err.message);
		}
	});
});


logTemperature();
setInterval(logTemperature, 60000);

app.listen(3000, () => {
	console.log('http:\/\/0.0.0.0:3000');
});
