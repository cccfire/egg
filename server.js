const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const server = new WebSocket.Server({
  port: 8080
});

let sockets = [];
var players = new Map();
var socketToPlayer = new Map();

function vector2(x,y){
  return {x: x, y: y};
}

function replacer(key, value) {
  const originalObject = this[key];
  if(originalObject instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(originalObject.entries()), // or with spread: value: [...originalObject]
    };
  } else {
    return value;
  }
}

var hitboxfunctions = new Map();
hitboxfunctions.set('sword',
function (p, po, angler){
  var x1 = p.x + 32 * Math.cos(angler);
  var y1 = p.y + 32 * Math.sin(angler);
  var x2 = p.x + (32 + this.width) * Math.cos(angler);
  var y2 = p.y + (32 + this.width) * Math.sin(angler);
  var dot = (po.x - x1) * (x2 - x1) + (po.y - y1) * (y2 - y1);
  var dist1 = distance(x1, y1, x2, y2);
  var dist2 = distance(x1, y1, po.x, po.y);
  var angle = Math.acos(dot / (dist1 * dist2));
  var dist3 = dist2 * Math.sin(angle);
  var x3 = p.x + (32 + dot) * Math.cos(angler);
  var y3 = p.y + (32 + dot) * Math.sin(angler);
  if(dist2 < 32
  || distsq(x2, y2, po.x, po.y) < Math.pow(32, 2)
  || dist3 < 32){
    return true;
  }else{
    return false;
  }
}
)

function weaponMaker(){
  var prox = {
    type: 'sword',
    width: 80,
    height: 10
  }

  return prox;
}


function playerMaker(socket){

  var proxid = uuidv4();
  var prox = {
    x: Math.floor(Math.random() * 300 + 1),
    y: Math.floor(Math.random() * 300 + 1),
    direction: vector2(0, 0),
    facing: 0,
    speed: 0.5,
    dex: 1,
    uuid: proxid,
    weapon: weaponMaker(),
    lastattacked: 0,
    isattacking: false,
    animationstart: 0,
    animated: false,
    hitlist: []
  };
  players.set(proxid, prox);
  socketToPlayer.set(socket, prox);
  return prox;
}

server.on('connection', function(socket) {
  //console.log(socket);
  sockets.push(socket);
  var proxplayer = playerMaker(socket);
  socket.send(JSON.stringify({type: 'spawn', player: proxplayer}));
  socket.send(JSON.stringify({type: 'playerlist', action: 'posit', info: players}, replacer));
  sockets.forEach(s => s.send(JSON.stringify({type: 'playerlist', action: 'add', info: proxplayer})));
  // When you receive a message, send that message to every socket.
  socket.on('message', function(msg) {
    try{
      mess = JSON.parse(msg);
      //console.log(players);
      switch(mess.type){
        case "mousedown":
          players.get(mess.uuid).isattacking = true;
          break;
        case "mouseup":
          players.get(mess.uuid).isattacking = false;
          break;
        case "facinginput":
          sockets.forEach(s => s.send(msg));
          players.get(mess.uuid).facing = mess.angle;
          break;
        case "playerinput":
          var keysDown = mess.keysDown;
          var proxvector;
          if (87 in keysDown) { // Player holding up
            if (65 in keysDown) {
              proxvector = vector2(-1/Math.sqrt(2), -1/Math.sqrt(2));
            } else if (68 in keysDown) {
              proxvector = vector2(1/Math.sqrt(2), -1/Math.sqrt(2));
            } else {
              proxvector = vector2(0, -1);
            }
          }
          else if (83 in keysDown) { // Player holding down
            if (65 in keysDown) {
              proxvector = vector2(-1/Math.sqrt(2), 1/Math.sqrt(2));
            } else if (68 in keysDown) {
              proxvector = vector2(1/Math.sqrt(2), 1/Math.sqrt(2));
            } else {
              proxvector = vector2(0, 1);
            }
          }
          else if (65 in keysDown) { // Player holding left
            proxvector = vector2(-1, 0);
          }
          else if (68 in keysDown) { // Player holding right
            proxvector = vector2(1, 0);
          }else{
            proxvector = vector2(0, 0);
          }

          var p = players.get(mess.uuid);
          var timestamp = Date.now();
          //console.log(now);

          sockets.forEach(s => s.send(JSON.stringify({type: 'playerdirection', action: 'set', timestamp: timestamp, info: proxvector, uuid: mess.uuid})));
          //console.log(Date.now());
          var mod = timestamp - then;
          p.x = p.x + mod * p.direction.x * p.speed;
          p.y = p.y + mod * p.direction.y * p.speed;
          now = Date.now();
          p.direction = proxvector;
          p.x = p.x + (now - timestamp) * p.direction.x * p.speed;
          p.y = p.y + (now - timestamp) * p.direction.y * p.speed;
          then = now;
          console.log(players)
          break;
      }
    }catch(err){
      console.log(err);
    }
    console.log(msg);

    //console.log(msg);
  //  console.log(sockets);
    //sockets.forEach(s => s.send(msg));
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {

      var proxid = socketToPlayer.get(socket).uuid;

      sockets = sockets.filter(s => s !== socket);
      sockets.forEach(s => s.send(JSON.stringify({type: 'playerlist', action: 'remove', info: proxid})))
      players.delete(proxid);
      socketToPlayer.delete(socket);

  });
});

function distance(x, y, x1, y1){
  return Math.sqrt(Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2));
}

function distsq(x, y, x1, y1){
  return Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2);
}

var update = function(mod) {
  for(let p of players.values()){
    p.x = p.x + mod * p.direction.x * p.speed;
    p.y = p.y + mod * p.direction.y * p.speed;
    if(p.isattacking && Date.now() - p.lastattacked > (p.dex * 1000)){
      var date = Date.now();
      sockets.forEach(s => s.send(JSON.stringify({type: 'requestanimation', action: 'attack', uuid: p.uuid, now: date})));
      p.lastattacked = date;
      p.hitlist = [];
    }
    if(Date.now() - p.lastattacked < (p.dex * 500)){
      var proxangle = Math.abs((Date.now() - p.lastattacked)*2*Math.PI/500 - Math.PI/2) - Math.PI/2
      var angler = p.facing + Math.PI/4 + proxangle;



      for(let po of players.values()){
        if(!(p.hitlist.includes(po)) && po != p){

          if(hitboxfunctions.get(p.weapon.type).call(p.weapon, p, po, angler)){
            sockets.forEach(s => s.send(JSON.stringify({type: 'message', msg: 'hit', uuid: po.uuid})));
            p.hitlist.push(po);
          }else{

          }

        }
      }
    }
  }
}


var main = function() {

  var now = Date.now();
  var delta = now - then;
  update(delta);
  then = now;

  setImmediate(main);
}
var then = Date.now();
main();
