var AWS = require('aws-sdk')
var http = require('http')

AWS.config.update({region: "us-east-1"});

var ecs = new AWS.ECS();
var ec2 = new AWS.EC2();

var start = Date.now()
var containers;

http.createServer(function(req, res) {
  if (req.url == '/get_server') {
      if(Date.now() - start > 1000){
        UpdateInstanceDetails((details) => {
          containers = details;
          console.log('done getting data')
          res.write(JSON.stringify(details));
          res.end();
        })
      } else {
      res.write(JSON.stringify(containers));
      res.end();
    }
  } else {
          res.end();
  }
}).listen(8080);

function UpdateInstanceDetails(callback){
  ecs.listTasks({cluster: "underlunchers"}, function(err, data) {
    if (err) console.log(err, err.stack);
    else     describeTasks(data, callback);
  });
}

function describeTasks(params, callback) {
  ecs.describeTasks({cluster: "underlunchers", tasks: params.taskArns}, function(err, data) {
    if (err) console.log(err, err.stack);
    else {
      var count = 0;
      data.tasks.forEach((t) => {if(t.group == 'service:game-server') count++})
      var current = 0;
      var allData = [];
      data.tasks.forEach((t) => {
        if (t.group == 'service:game-server'){
          var bindings = t.containers[0].networkBindings;
          describeContainerInstance(
            {
              cluster:"underlunchers",
              containerInstances: [t.containerInstanceArn]}, bindings, (data) =>
              {
                current++
                allData.push(data)
                console.log(data)
                console.log(current + ", " + count)
                if(current == count){
                  callback(allData)
                }
              })
        }
    })}
  });
}

function describeContainerInstance(params, bindings, callback) {
  ecs.describeContainerInstances(params, function(err, data) {
    if(err) console.log(err, err.stack)
    else {
      describeInstance({InstanceIds:[data.containerInstances[0].ec2InstanceId]}, bindings, callback)
    }
  })
}

function describeInstance(params, bindings, callback) {
  ec2.describeInstances(params, function(err, data){
    if(err) console.log(err,err.stack)
    else {
      var publicContainerDetails =
      {
        PublicDnsName: data.Reservations[0].Instances[0].PublicDnsName,
      }
      bindings.forEach(b => {
        if(b.protocol == 'udp'){
          publicContainerDetails.port = b.hostPort
        }
      })
      callback(publicContainerDetails);
    }
  })
}
