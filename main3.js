var wifi = require("Wifi"),
  storage = require("Storage"),
  options = {
    // ALL OPTIONAL - the defaults are below
    client_id: getSerial(), // the client ID sent to MQTT - it's a good idea to define your own static one based on `getSerial()`
    keep_alive: 60, // keep alive time in seconds
    port: 1883, // port number
    clean_session: true,
    username: "username", // default is undefined
    password: "password", // default is undefined
    protocol_name: "MQTT", // or MQIsdp, etc..
    protocol_level: 4 // protocol level
  },
  httpSrv,
  mqtt;

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
    <h1>Client Configuration</h1>
    <form action="/" method="post">
      <label for="ssid">Network Name
        <input type="text" name="s" id="ssid">
      </label>
      <label for="password">Password
        <input type="text" name="p" id="password">
      </label>
      <label for="mqttserver">MQTT Server
        <input type="text" name="m" id="mqttserver">
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
    <title>Client Configuration</title>
  </head>
  <body>
    <style>
      label {
        display: block;
        padding: 5px;
      }
    </style>
    <h1>Client Configuration</h1>
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
    var postData = {};
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
        monitorWifiStationStatus();
        connectWifiStation(postData);
      }, 3000);
    }
    //
    //
    // call our callback (to send the HTML result)
    callback();
  });
}

function startMQTT(server) {
  console.log("[startMQTT] connect to=", server);
  // mqtt.create(server, options /*optional*/);
  mqtt = require("MQTT").connect({ host: server });

  var buttonPressedHandler = function(event) {
    console.log(`[buttonPressedHandler] ${JSON.stringify(event)}`);
    var topic = "FROM_DEVICE";
    var message = "button press";
    mqtt.publish(topic, message);
  };

  clearWatch();
  setWatch(buttonPressedHandler, D0, {
    repeat: true,
    edge: "falling",
    debounce: 50
  });

  console.log("line 160");
  mqtt.on("connected", function() {
    console.log("[mqtt.on.connected]");
    mqtt.subscribe("TO_DEVICE");
  });

  mqtt.on("publish", function(pub) {
    console.log("topic: " + pub.topic);
    console.log("message: " + pub.message);
    if (pub.topic == "TO_DEVICE") {
      if (pub.message == "001") {
        digitalWrite(D2, false);
      }
      if (pub.message == "000") {
        digitalWrite(D2, true);
      }
    }
  });

  // mqtt.on("disconnected", function() {
  //   console.log("MQTT disconnected... reconnecting.");
  //   setTimeout(function() {
  //     mqtt.connect();
  //   }, 1000);
  // });
}

function startHttpServer() {
  if (httpSrv === undefined || httpSrv === null) {
    httpSrv = require("http").createServer(onPageRequest);
    console.log("[startHttpServer] Successfully created httpSrv.");
    httpSrv.listen(80);
    console.log("[startHttpServer] httpSrv listening on port 80.");
  }
}

function startWifiAP() {
  wifi.startAP("espruino-esp8266", {}, function(err) {
    if (err) {
      console.log("[startWifiAP] Failed to start AP mode. err" + err);
      return;
    }
    console.log("[startWifiAP] Successfully started AP mode.");

    startHttpServer();
  });
}

function connectWifiStation(config) {
  wifi.removeAllListeners("disconnected");
  wifi.connect(
    config.s,
    { password: config.p },
    function(err) {
      if (err) {
        console.log("[connectWifiStation] Failed to connect wifi. err=", err);
        wifi.disconnect();
        return;
      }
      console.log("[connectWifiStation] Successfully connected wifi.");

      wifi.on("disconnected", function(details) {
        console.log(
          "[connectWifiStation] [wifi.on.disconnected] details=" +
            details.toString()
        );
        main();
      });

      startMQTT(config.m);

      var result = storage.write("data", config);
      console.log(
        "[connectWifiStation] " + (result ? "Data Saved" : "Failed To Save")
      );
    }
  );
}

function monitorWifiStationStatus() {
  var counter = 0;
  var id = setInterval(function() {
    wifi.getDetails(function(res) {
      counter++;
      console.log(`[monitorWifiStationStatus] ${res.status} #${counter}`);
      //status - off, connecting, wrong_password, no_ap_found, connect_fail, connected
      if (
        res.status == "no_ap_found" ||
        res.status == "wrong_password" ||
        res.status == "off" ||
        res.status == "connect_failed"
      ) {
        clearInterval(id);
        startWifiAP();
      } else if (res.status == "connected") {
        clearInterval(id);
      } else if (res.status == "connecting" && counter > 59) {
        clearInterval(id);
        wifi.disconnect();
        startWifiAP();
      }
    });
  }, 1000);
}

function main() {
  monitorWifiStationStatus();
  var config = storage.readJSON("data");
  if (config !== undefined && config.s !== undefined) {
    connectWifiStation(config);
  }
}

function onInit() {
  // storage.read('data') == undefined
  //storage.erase("data");

  wifi.stopAP();
  pinMode(D2, "output");
  pinMode(D0, "input_pullup");
  main();
}

//onInit();
