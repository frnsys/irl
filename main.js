import './static/css/main.sass';
import $ from 'jquery';
import _ from 'underscore';
import Environment from './src/Environment';

const TWEET_INTERVAL = 4000;
const CHAT_RADIUS = 4;

$('input').on('keydown', function(ev) {
  if (ev.which === 13) {
    var screen_name = $('input').val().replace('@', '');
    $('.intro').text('loading...');
    $.get(`/convos/${screen_name}`, function(data) {
      $('.intro').remove();
      var env = new Environment(100, 100),
          agents = {};

      var agentsLoaded = 0;
      _.each(data.users, u => {
        agents[u.screen_name] = env.addAgent(u, () => {
          agentsLoaded++;
          if (agentsLoaded == data.users.length) {
            play_convos(agents, data);
          }
        });
      });

      //env.origin();
      env.render();
    });
  }
});

function play_convos(agents, data) {
  if (data.roots.length > 0) {
    start_convo(data.roots.shift(), agents, data, () => play_convos(agents, data));
  }
}

function start_convo(root, agents, data, cb) {
  var thread = [root].concat(get_thread(root, data)),
      users = participants(thread);

  // converge on OP's position
  var op = agents[users[0]],
      arrived = 0;

  if (users.length > 1) {
    _.chain(users).rest().each(u => {
      // don't go _exactly_ onto OP's position
      var angle = Math.random()*Math.PI*2,
          pos = {
            x: op.mesh.position.x + Math.cos(angle) * CHAT_RADIUS,
            y: op.mesh.position.y,
            z: op.mesh.position.z + Math.sin(angle) * CHAT_RADIUS
          }

      agents[u].goTo(pos, (agent) => {
        // look at OP
        agent.mesh.lookAt(op.mesh.position);

        arrived++;
        if (arrived == users.length - 1) {
          tweet(thread, agents, cb);
        }
      });
    });
  } else {
    tweet(thread, agents, cb);
  }
}

// reconstruct a thread from a tweet
function get_thread(tweet, data) {
  var thread = data.convos[tweet.id_str] || [];
  return thread.concat(
    _.chain(thread).map(t => get_thread(t, data)).flatten().value()
  );
}

// get screen names of participants in a thread
function participants(thread) {
  return _.chain(thread).map(t => t.user.screen_name).uniq().value();
}

function tweet(thread, agents, cb) {
  var t = thread.shift(),
      agent = agents[t.user.screen_name];
  agent.showThought(t.text, TWEET_INTERVAL, () => {
    if (thread.length > 0) {
      tweet(thread, agents, cb);
    } else {
      // convo done
      cb();
    }
  });
}
