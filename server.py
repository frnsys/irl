from collect import assemble_conversations
from flask import Flask, jsonify, render_template

app = Flask(__name__,
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/convos/<screen_name>')
def convos(screen_name):
    # TODO should probably verify screen_name or something
    roots, convos, users = assemble_conversations(screen_name)
    return jsonify({
        'roots': roots,
        'convos': convos,
        'users': users
    })

if __name__ == '__main__':
    app.run(debug=False, port=5010)