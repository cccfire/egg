var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

var ready = false;

var smileyReady = false;
var smileyImage = new Image();
smileyImage.onload = function() {
  smileyReady = true;
};
smileyImage.src = "smiley.png";

var keysDown = {};

const ws = new WebSocket('ws://localhost:8080');

function reviver(key, value) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

function calculateAnimation(){

}

// Browser WebSockets have slightly different syntax than `ws`.
// Instead of EventEmitter syntax `on('open')`, you assign a callback
// to the `onopen` property.

var uuid;
var players = new Map();

ws.onopen = function() {
  ready = true;
};

//ws.send('hi');

ws.onmessage = function(msg) {
  try{
    mess = JSON.parse(msg.data, reviver);
    switch(mess.type){
      case "spawn":
        uuid = mess.player.uuid;
        break;
      case "requestanimation":
        switch(mess.action){
          case "attack":
            var p = players.get(mess.uuid);
            p.animated = true;
            p.animationstart = mess.now;
            break;
        }
        break;
      case "playerlist":

        switch(mess.action){
          case "posit":
            players = mess.info;
            break;
          case "add":
            players.set(mess.info.uuid, mess.info);
            break;
          case "remove":
            players.delete(mess.info);
            break;
        }

        break;
      case "facinginput":
        players.get(mess.uuid).facing = mess.angle;
        break;
      case "playerdirection":
        switch(mess.action){
          case "set":
            var p = players.get(mess.uuid);
            var now = Date.now();

            var mod = mess.timestamp - then;
            p.x = p.x + mod * p.direction.x * p.speed;
            p.y = p.y + mod * p.direction.y * p.speed;

            var delts = now - mess.timestamp;
            p.direction = mess.info;
            p.x = p.x + delts * p.direction.x * p.speed;
            p.y = p.y + delts * p.direction.y * p.speed;
            then = now;
            break;
        }
        break;
      case "ping":
        ws.send(JSON.stringify({message: 'pong'}));
        break;
    }
  }catch(err){
    console.log(err);
  }
  console.log(msg.data);
};



window.onbeforeunload = function() {
    ws.onclose = function () {}; // disable onclose handler first
    ws.close();
};


canvas.addEventListener("mousemove", (e) => {
  try{
    var x = e.offsetX;
    var y = e.offsetY;
    var p = players.get(uuid);
    var A = Math.atan((y - p.y)/(x - p.x));
    if(x-p.x < 0){
  		A = A + Math.PI;
  	}
    if(ready){
      ws.send(JSON.stringify({type: "facinginput", angle: A, uuid: uuid}))
    }
  }catch(err){
    console.log(err);
  }
}, false);

canvas.addEventListener("mousedown", function(e) {
  if(ready)
    ws.send(JSON.stringify({type: 'mousedown', buttonid: 0, uuid: uuid}));
}, false);

canvas.addEventListener("mouseup", function(e) {
  if(ready)
    ws.send(JSON.stringify({type: 'mouseup', buttonid: 0, uuid: uuid}));
}, false);

addEventListener("keydown", function(e) {
  if(!(e.keyCode in keysDown)){
    keysDown[e.keyCode] = true;
    console.log(e.keyCode);
    if(ready)
      ws.send(JSON.stringify({type: 'playerinput', keysDown: keysDown, uuid: uuid}));
  }
}, false);

addEventListener("keyup", function(e) {
  if(e.keyCode in keysDown){
    delete keysDown[e.keyCode];
    console.log(e.keyCode);
    if(ready)
      ws.send(JSON.stringify({type: 'playerinput', keysDown: keysDown, uuid: uuid}));
  }
}, false);


var reset = function() {

}

var render = function() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#F1C27D";
  for(let p of players.values()){

    var proxangle = 0;
    if(p.animated){
      proxangle = Math.abs((Date.now() - p.animationstart)*2*Math.PI/500 - Math.PI/2) - Math.PI/2
      if(proxangle > 0){
        p.animated = false;
      }
    }


    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing + proxangle);
    ctx.translate(-p.x, -p.y);
    ctx.fillStyle = 'red';
    ctx.fillRect(p.x + 32, p.y + 32 - p.weapon.height, p.weapon.width, p.weapon.height);
    ctx.translate(p.x, p.y);
    ctx.rotate(-p.facing - proxangle);
    ctx.translate(-p.x, -p.y);

    ctx.fillStyle = "#F1C27D";
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.arc(p.x + 32 * Math.cos(p.facing + Math.PI/4 + proxangle), p.y + 32 * Math.sin(p.facing + Math.PI/4 + proxangle), 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.arc(p.x + 32 * Math.cos(p.facing - Math.PI/4 + proxangle), p.y + 32 * Math.sin(p.facing - Math.PI/4 + proxangle), 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.arc(p.x, p.y, 32, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

      /*
      ctx.drawImage(smileyImage, p.x, p.y,
        64, 64);
      */
  }



}

var update = function(mod) {
  for(let p of players.values()){
    p.x = p.x + mod * p.direction.x * p.speed;
    p.y = p.y + mod * p.direction.y * p.speed;
  }

  render();
}


var main = function() {

  var now = Date.now();
  var delta = now - then;
  update(delta);
  then = now;

  requestAnimationFrame(main);
}
var then = Date.now();

reset();
main();
