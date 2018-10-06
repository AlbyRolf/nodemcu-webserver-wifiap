var wifi = require("Wifi");
var storage = require("Storage");

// The last data that was POSTed to us
var postData = {};

// This serves up the webpage itself
function sendPage(res) {
  // We're using ES6 Template Literals here to make the HTML easy to read.
  var d = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wifi Client Configuration</title>
  </head>
  <body>
    <style>
      label {
        display: block;
        padding: 5px;
      }
    </style>
    <h1>Wifi Client Configuration</h1>
    <form action="/" method="post">
      <label for="ssid">Network Name
        <input type="text" name="s" id="ssid">
      </label>
      <label for="password">Password
        <input type="text" name="p" id="password">
      </label>
      <label for="nodecode">Node Code
        <input type="text" name="c" id="nodecode">
      </label>
      <div>
        <button>Save</button>
      </div>
    </form>    
  </body>
  </html>`;
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": d.length
  });
  res.end(d);
}

// This handles the HTTP request itself and serves up the webpage or a
// 404 not found page
function onPageRequest(req, res) {
  var a = url.parse(req.url, true);
  if (a.pathname == "/") {
    // handle the '/' (root) page...
    // If we had a POST, handle the data we're being given
    if (
      req.method == "POST" &&
      req.headers["Content-Type"] == "application/x-www-form-urlencoded"
    )
      handlePOST(req, function() {
        sendPage(res);
      });
    else sendPage(res);
  } else {
    // Page not found - return 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404: Page " + a.pathname + " not found");
  }
}

// This handles any received data from the POST request
function handlePOST(req, callback) {
  var data = "";
  req.on("data", function(d) {
    data += d;
  });
  req.on("end", function() {
    // All data received from the client, so handle the url encoded data we got
    // If we used 'close' then the HTTP request would have been closed and we
    // would be unable to send the result page.
    postData = {};
    data.split("&").forEach(function(el) {
      var els = el.split("=");
      postData[els[0]] = decodeURIComponent(els[1]);
    });
    // finally our data is in postData
    console.log(postData);
    // do stuff with it!
    //
    var result = storage.write("data", postData);
    console.log(result ? "Data Saved" : "Failed To Save");
    //
    //
    // call our callback (to send the HTML result)
    callback();
  });
}

function startWebserver() {
  require("http")
    .createServer(onPageRequest)
    .listen(80);
}

function wifiConnect(ssid, password, cb) {
  wifi.connect(
    ssid,
    { password: password },
    function(err) {
      if (err) {
        return cb(err);
      }
      console.log("Successfully connected.");
      return cb(null, true);
    }
  );
}

function startAP(cb) {
  wifi.startAP("espruino-esp8266", {}, function(err) {
    if (err) {
      return cb(err);
    }
    console.log("Successfully started AP.");
    return cb(null, true);
  });
}

function main() {
  //scenario 1
  // storage.read('data') == undefined
  //storage.erase("data");
  //scenario 2
  // wrong password
  storage.write("data", { s: "CLAVEL", p: "xxx", c: "xxx" });
  //scenario 3
  // incorrect ssid
  //storage.write("data", {"s":"CLAVEL1", "p":"4157319535", "c":"xxx"});
  //scenario 4
  // correct data
  //storage.write("data", {"s":"CLAVEL", "p":"4157319535", "c":"xxx"});

  if (storage.read("data") === undefined) {
    startAP(function(err, result) {
      if (err) {
        return console.log(err);
      }
      startWebserver();
    });
  } else {
    var config = storage.read("data");
    wifiConnect(config.s, config.p, function() {
      if (err) {
        return console.log(err);
      }
    });
  }
}

main();
