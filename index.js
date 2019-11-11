var http = require('http');
var librequest = require('request');
var vks = require('victor-smart-kill');
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("Victor Smart Kill Plugin, Homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  homebridge.registerPlatform("homebridge-victor-smart-kill", "VictorSmartKill", VKS_Platform, true);
}

// Platform constructor
function VKS_Platform(log, config, api) {
  log("VKS_Platform Init");
  var platform = this;
  var default_interval = 60 * 60 * 1000;  // 1 hour = 3600000 ms
  this.log = log;
  this.config = config;
  this.accessories = [];
  this.username = config['username'];
  this.password = config['password'];
  this.interval = config['interval'] || default_interval;
  this.token = null;
  this.api = api;

  vks.check_traps(this.username,
                  this.password,
                  this.add_traps_callback,
                  this);

  setInterval(function(obj) {return vks.check_traps(obj.username,
                                                    obj.password,
                                                    obj.add_traps_callback,
                                                    obj);
                            },
              this.interval,
              this);
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
VKS_Platform.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true;

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });

  if (accessory.getService(Service.MotionSensor)) {
    accessory.getService(Service.MotionSensor)
        .getCharacteristic(Characteristic.MotionDetected)
        .on('set', function(value, callback) {
            console.log(accessory.displayName, "Trap -> " + value);
            callback();
        });
  }

  this.log("configureAccessory");
  this.accessories.push(accessory);
}

VKS_Platform.prototype.add_traps_callback = function(error, response, body)
{
  this.log("Add Traps Callback");
  var uuid;

  if (!error && response.statusCode == 200) {
    const info = JSON.parse(body);
    for (var ii in info['results']) {
      var obj = info['results'][ii];
      var displayName = obj['name'];
      var kills_present = obj['trapstatistics']['kills_present'];
      uuid = UUIDGen.generate(displayName);
      this.log(displayName);
      var found_accessory = false;

      this.log("kills present = " + kills_present);

      for (var kk in this.accessories)
      {
          var accessory = this.accessories[kk];
          this.log("accessory name = " + accessory.displayName)
          if (accessory.displayName == displayName)
          {
              this.log("Found accessory " + displayName);
              found_accessory = true;

              if (kills_present > 0)
              {
                accessory.getService(Service.MotionSensor)
                         .getCharacteristic(Characteristic.MotionDetected)
                         .setValue(true);
                this.log("alert motion sensor!!");
              }
              else if (kills_present <= 0)
              {
                accessory.getService(Service.MotionSensor)
                         .getCharacteristic(Characteristic.MotionDetected)
                         .setValue(false);
                this.log("no kills present");
              }
          }
      }

      if (!found_accessory)
      {
        this.log("Adding accessory ", displayName, " to list");

        uuid = UUIDGen.generate(displayName);
        var newAccessory = new Accessory(displayName, uuid);
        newAccessory.displayName = displayName;
        newAccessory.on('identify', function(paired, callback) {
            console.log(newAccessory.displayName, "Identify!!!");
            callback();
        });

        // Plugin can save context on accessory to help restore accessory in configureAccessory()

        // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
        newAccessory.addService(Service.MotionSensor, displayName + " Mouse Trap")
            .getCharacteristic(Characteristic.MotionDetected)
            .on('set', function(value, callback) {
                console.log(newAccessory.displayName, "Trap -> " + value);
                callback();
            }
        );

        this.accessories.push(newAccessory);
        this.api.registerPlatformAccessories("homebridge-victor-smart-kill", "VictorSmartKill", [newAccessory]);
      }
    }
  }
  else{
      this.log(response);
  }
}
