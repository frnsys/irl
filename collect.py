import config
from twython import Twython

api = Twython(config.consumer_key,
              config.consumer_secret,
              config.access_token,
              config.access_token_secret)

def get_profile_image(screen_name):
    user = api.show_user(screen_name=screen_name)
    return user['profile_image_url_https'].replace('_normal', '')

def get_tweets(screen_name):
    return api.get_user_timeline(
        screen_name=screen_name,
        include_rts=False,
        exclude_replies=False,
        count=200) # max is 200

def get_mentions(screen_name):
    return api.search(
        count=100, # max is 100
        result_type='recent',
        q='@{}'.format(screen_name))['statuses']

def get_users(screen_names):
    chunk_size = 100 # max 100/request
    users = []
    for i in range(0, len(screen_names), chunk_size):
        users += api.lookup_user(screen_name=screen_names[i:i+chunk_size])
    return users

def lookup_tweets(ids):
    chunk_size = 100 # max 100/request
    tweets = []
    for i in range(0, len(ids), chunk_size):
        tweets + api.lookup_status(id=ids[i:i+chunk_size])
    return tweets

def assemble_conversations(screen_name, max_depth=10):
    tweets = get_tweets(screen_name) + get_mentions(screen_name)

    # fetch tweets in threads
    children = tweets
    for _ in range(max_depth):
        parents = []
        ids = [t['id'] for t in tweets]
        for t in children:
            parent_id = t['in_reply_to_status_id']
            if parent_id is not None and parent_id not in ids:
                parents.append(parent_id)
        if not parents:
            break
        children = lookup_tweets(parents)
        tweets += children

    # assemble threads
    roots = []
    ids = [t['id'] for t in tweets]
    screen_names = list({t['user']['screen_name'] for t in tweets})
    convos = {}
    for t in tweets:
        parent_id = t['in_reply_to_status_id']
        if parent_id is None or parent_id not in ids:
            roots.append(t)
            continue
        elif parent_id not in convos:
            convos[parent_id] = []
        convos[parent_id].append(t)

    users = get_users(screen_names)

    return roots, convos, users

if __name__ == '__main__':
    import json
    roots, convos, users = assemble_conversations('frnsys')
    with open('tweets.json', 'w') as f:
        json.dump({
            'roots': roots,
            'convos': convos,
            'users': users
        }, f)