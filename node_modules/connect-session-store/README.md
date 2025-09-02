# connect-session-store

## Installation

    npm install connect-session-store

## Usage


```
var connect = require('connect')
  , SessionStore = require('../lib/connect-session-store');

var options = {
  storeType: 'file',
  storeOptions: {
    path:'.',
    useAsync:true,
    reapInterval: 5000,
    maxAge: 10000
  }
};

connect(
  connect.cookieParser(),
  connect.session({
    secret:'session file',
    store: SessionStore(options)
  }),
  function(req,res,next) {
    if (req.session.views) {
      sess.views++;
      res.setHeader('Content-Type', 'text/html');
      res.write('<p>views: ' + req.session.views + '</p>');
      res.end();
    } else {
      sess.views = 1;
      res.end('welcome to the file session demo. refresh!');
    }
  }
).listen(8080);
```

## Options

    - `storeType` store type ('file' or 'redis')
    - `storeOptions` the store option
   
For more `storeOptions` see: [connect-file-store](https://github.com/jkeylu/connect-file-store) and [connect-redis](https://github.com/visionmedia/connect-redis)

## Example

See examples/app.js

## License

(The MIT License)

Copyright (c) 2013 jKey Lu &lt;jkeylu@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
