var listen_port = 10080;

//var client = require('redis').createClient({host:'redis'});
var http = require('http');
var fs = require('fs');
var url = require('url');
var server = http.createServer();　
var twitter = require('twitter');
//var oauth2 = require('oauth').OAuth2; 
var log4js = require('log4js');
var logger = exports = module.exports = {};
var twitter_api_config = require('./twitter_api_config.js');
var raid_list = require('./raids.js');
var get_time = new Date();
var streams = null;

function check_disconnect_timer(){
  var now_time = new Date();
  if(now_time - get_time > 120000 && streams !== null){
    logger.request.info('re_connect');
    streams.destroy();
    get_raider();
  }
}

setInterval(check_disconnect_timer,60000);

log4js.configure({
     appenders: [
         {
             "type": "dateFile",
             "category": "request",
             "filename": "./log/request.log",
             "pattern": "-yyyy-MM-dd"
         },
         {
             "type": "dateFile",
             "category": "connect",
             "filename": "./log/connect.log",
             "pattern": "-yyyy-MM-dd"
         }
    ]
});
logger.request = log4js.getLogger('request');
logger.connect = log4js.getLogger('connect');
logger.request.error('start stream'); 

var tw_client = null;
//var oauth2 = new oauth2(twitter_api_config.c_key, twitter_api_config.c_secret, 'https://api.twitter.com/', null, 'oauth2/token', null);

//oauth2.getOAuthAccessToken('', {
//    'grant_type': 'client_credentials'
//  }, function (e, access_token) {
var tw_client = null;

function connect_client(){
    tw_client = new twitter({
      consumer_key: twitter_api_config.c_key,
      consumer_secret: twitter_api_config.c_secret,
      access_token_key: twitter_api_config.a_key,
      access_token_secret: twitter_api_config.a_secret,
//      bearer_token: access_token
    });
}

function get_raider(){
    connect_client();
    tw_client.stream('statuses/filter', {track: 'Lv150,Lv100,Lv110,Lv120,Lv75,Lv70,Lv60,Lv50'}, function(stream) {
      streams = stream;
      stream.on('data', function(event){
        logger.request.info(event['text']);
        get_time = new Date();
        if(event['text'].match(/\n/)){
          var str = event['text'].split("\n");
          //str[0]:コメント+ID,str[1]:lv+raid名
          event['text'] = str[0]+" "+str[1];
          data = {};
          if(str[0].match(/参加者募集！参戦ID：/) ){
            event['text'] = event['text'].replace(/参加者募集\！参戦\I\D\：/,"");
            data['text'] = event['text'];
            data['date'] = event['created_at'];
            data['id'] = event['text'].match(/[0-9a-zA-Z]{8}?/);
            var is_emit = false;
            raids_for:
            for(var index in raid_list['multi']){
              var reg = new RegExp(index);
              if(str[1].match(reg)){
                for(index1 in raid_list['multi'][index]){
                  var reg1 = new RegExp(index1);
                  if(str[1].match(reg1)){
                    data['type'] = raid_list['multi'][index][index1];
                    is_emit = true;
                    break raids_for;
                  }
                }
              }
            }
            if(is_emit){
              io.sockets.emit('write', {value:data});
            }
          }
        }
      });
      stream.on('error', function(event){
        logger.request.error('error stream'); 
        logger.request.error(event);
      });
      stream.on('end', function(reason) {
        logger.request.error('end stream'); 
        logger.request.error(reason); 
      });
    });
//});
}
get_raider();

server.on('request', function(req, res) {
  var path = url.parse(req.url).pathname;
  if(path == '/index.html' || path == '/') {
    res.writeHead(200, {'Content-Type': 'text/html'});
     var output = fs.readFileSync("./index.html", "utf-8");
     res.write(output);
  }else if(path === '/favicon.ico'){
      res.writeHead(403, {'Content-Type': 'text/html'});
  }else{
    if (fs.existsSync(__dirname + path)) {  
      res.writeHead(200, {'Content-Type': 'text/html'});
      var output = fs.readFileSync(__dirname + path,"utf-8");
      res.write(output);
    }else{
      res.writeHead(403, {'Content-Type': 'text/html'});
    }
  }
  res.end();
});

var io = require('socket.io').listen(server);
var connect_count = 0;

io.sockets.on('connection', function(socket) {
  
  connect_count += 1;
  logger.connect.info('open socket: now connect '+connect_count+' '+JSON.stringify(socket.handshake));

  socket.on("send_to_all", function (data) {
    var send = {};
    send['text'] = data.value;
    var date = new Date();
    date.setHours(date.getHours() + 9);
    send['date'] = ("0"+date.getHours()).slice(-2) + ":" + ("0"+(date.getMinutes() + 1)).slice(-2) + ":" + ("0"+date.getSeconds()).slice(-2);
    io.sockets.emit("send_to_all", {value:send});
  });
  
  socket.on("send_to_other", function (data) {
    //socket.broadcast.emit("write", {value:data.value});
  });

  socket.on("disconnect", function () {
    connect_count -= 1;
    logger.connect.info('close socket: now connect '+connect_count); 
  });

});

server.listen(listen_port);
