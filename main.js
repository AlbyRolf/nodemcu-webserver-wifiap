var wifi = require("Wifi"),
  storage = require("Storage");

// The last data that was POSTed to us
var postData = {};
var httpSrv;

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

function byePage(res) {
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
    <h2>You can now close this page</h2>
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
        byePage(res);
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
    console.log("[handlePOST] ", postData);
    // do stuff with it!
    //
    if (postData.s) {
      setTimeout(function() {
        //console.log("[handlePOST] httpSrv.close");
        //httpSrv.close();
        wifi.stopAP();
        checkWifiStation();
        wifiConnect(postData);
      }, 3000);
    }
    //
    //
    // call our callback (to send the HTML result)
    callback();
  });
}

function wifiConnect(config) {
  wifi.removeAllListeners("disconnected");
  wifi.connect(
    config.s,
    { password: config.p },
    function(err) {
      if (err) {
        console.log(err);
        if (err == "auth_expire") {
          // wifi.disconnect();
        }
        return console.log("[wifiConnect] Failed to connect.");
      }
      console.log("[WifiConnect] Successfully connected.");

      wifi.on("disconnected", function(details) {
        reconfig("[wifi.on.disconnected] " + details.toString());
      });

      var result = storage.write("data", config);
      console.log(
        "[WifiConnect] " + (result ? "Data Saved" : "Failed To Save")
      );
    }
  );
}

function startAP() {
  wifi.startAP("espruino-esp8266", {}, function(err) {
    if (err) {
      console.log("[startAP] " + err);
    }

    console.log("[startAP] Successfully started AP.");
    if (httpSrv === undefined || httpSrv === null) {
      httpSrv = require("http").createServer(onPageRequest);
      console.log("[startAP] Successfully created httpSrv.");
      httpSrv.listen(80);
      console.log("[startAP] httpSrv listening on port 80.");
    }
  });
}

function checkWifiStation() {
  var counter = 0;
  var id = setInterval(function() {
    wifi.getDetails(function(res) {
      counter++;
      console.log(`[checkWifiStation]  ${res.status} #${counter}`);
      //status - off, connecting, wrong_password, no_ap_found, connect_fail, connected
      if (
        res.status == "no_ap_found" ||
        res.status == "wrong_password" ||
        res.status == "off" ||
        res.status == "connect_failed"
      ) {
        reconfig("[FROM checkWifiStation] " + res.status);
        clearInterval(id);
      }
      if (res.status == "connected") {
        clearInterval(id);
      }
      if (res.status == "connecting" && counter > 59) {
        wifi.disconnect();
        clearInterval(id);
      }
    });
  }, 1000);
}

function reconfig(err) {
  console.log(err, "[reconfig] Reconfiguring ...");

  startAP();
}

function main() {
  // scenario 1
  // storage.read('data') == undefined
  //storage.erase("data");
  // scenario 2
  // wrong password
  //storage.write("data", { s: "CLAVEL", p: "xxx", c: "xxx" });
  // scenario 3
  // incorrect ssid
  //storage.write("data", { s: "CLAVEL1", p: "4157319535", c: "xxx" });
  // scenario 4
  // correct data
  storage.write("data", { s: "CLAVEL", p: "4157319535", c: "xxx" });

  checkWifiStation();
  var config = storage.readJSON("data");
  if (config !== undefined && config.s !== undefined) {
    wifiConnect(config);
    // wifi.connect(
    //   config.s,
    //   { password: config.p },
    //   function(err) {
    //     if (err) {
    //       // if (err === "auth_expire") {
    //       //   wifi.disconnect();
    //       // } else {
    //       //   reconfig("[FROM main] " + err);
    //       // }
    //       reconfig("[FROM main] " + err);
    //       return;
    //     }
    //     console.log("[main] Station connected.");
    //   }
    // );
  }
  // wifi.on("disconnected", function() {
  //   reconfig("[wifi.on.disconnected]");
  // });
}

function onInit() {
  wifi.stopAP();
  main();
}

onInit();
