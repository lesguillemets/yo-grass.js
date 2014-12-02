window.onload = function(){
  document.getElementById("run").onclick = runYoyo;
};

function runYoyo(){
  var code = document.getElementById("code").value;
  code = code.replace(/Yo/g, 'W').replace(/yo/g, 'w').replace(/!/g, 'v');
  var grass = new Grass(code);
  var output = grass.run();
  document.getElementById("output").innerHTML = output;
}

var tests ={};

function Stdin(letters){ // {{{
  this.letters = letters.split('');
  this.eof = false;
}

Stdin.prototype.readChar = function(){
  return this.letters.shift();
};

Stdin.prototype.feedChar = function(str){
  this.letters.push.apply(this.letters,str.split(''));
  return this.letters;
};

// test {{{
tests.Stdin = {
  message : "test for Stdin class",
  run:  function(){
    var stdin = new Stdin("FOO");
    stdin.feedChar("oo!");
    for (var i=0; i<10; i++){
      console.log(stdin.readChar());
    }
  }
};
// }}}
// }}}

// True and False {{{
var True = {apply : function(x){ return { apply: function(y){ return x; }}; }};
var False = { apply : function(x){ return { apply : function(y){ return y; }}; } };

tests.TorF = { //{{{
  message : "True and False (\\x->\\y->\\x, \\x->\\y->\\y)",
  run : function(){
    console.log(True(2)(5));
    console.log(False(3)(4));
  }
};
// }}}
//}}}

function GrassChar(c){ //{{{
  var f = { apply:  function(chr){
    console.log('\tgrassChar is called');
    return (f.charCode === chr.charCode ?  True : False);
  }} ;
  f.charCode = c.charCodeAt(0);
  f.succ = function(){
    return GrassChar.prototype.fromCharCode((f.charCode+1)%256);
  };
  f.toString = function(){
    return String.fromCharCode(f.charCode);
  };
  return f;
}

GrassChar.prototype.fromCharCode = function(charCode){
  return new GrassChar(String.fromCharCode(charCode));
};


// test {{{
tests.GrassChar = {
  message : "Char as in grass.",
  run : function(){
    var w = new GrassChar('w');
    console.log(w('w')(1)(2));
    console.log(w(new GrassChar('w'))(1)(2));
    console.log(w('n')(1)(2));
    console.log(w.succ().toString());
  }
};
// }}}
// }}}

// GrassMachine {{{
function GrassMachine(stdin){ //{{{
  this.stdin = stdin;
  this.output = "";
  // define primitives {{{
  var self=this;
  this.print = function(s){ this.output += s;};
  
  var in_ = {apply : function(arg){
    var l = self.stdin.readChar();
    return l === undefined ? arg : l;
  }};
  
  var succ = {apply : function(c){ return c.succ(); }};
  var out = {apply : function(c){
    self.print(c.toString());
    return c;
  }};
  // }}}
  this.stack = [in_, new GrassChar('w'), succ, out];
  this.stackl = this.stack.length;
}
//}}}

GrassMachine.prototype.apply = function(m,n){ // {{{
  this.stackl++;
  return apply(m,n,this.stack);
}; //}}}

function apply(m,n,stack){ //{{{
  var v = stack[stack.length-m].apply(stack[stack.length-n]);
  stack.push(v);
  return stack;
} //}}}

function GrassFunction(argsLeft, apps, localStack){ //{{{
  this.argsLeft = argsLeft;
  this.apps = apps;
  this.localStack = localStack;
} //}}}

GrassFunction.prototype.apply = function(arg){ // {{{
  var _argsLeft = this.argsLeft -1;
  var _localStack = this.localStack.concat([arg]);
  if (_argsLeft > 0){
    // need more arguments before working!!
    return new GrassFunction(_argsLeft, this.apps, _localStack);
  }
  else {
    for(var i=0; i<this.apps.length; i++){
      apply(this.apps[i][0], this.apps[i][1], _localStack);
    }
    return _localStack[_localStack.length-1];
  }
}; //}}}

GrassMachine.prototype.defun = function(numOfArgs, apps){ // {{{
  // apps : e.g: [[1,2], [3,2], [1,4]]
  // only application may appear in function body;
  // nested function is not allowed.
  var localStack = this.stack.slice();
  var f= new GrassFunction(numOfArgs, apps, localStack);
  this.stack.push(f);
  return f;
};
// }}}

tests.GrassMachine = { //{{{
  message : "GrassMachine",
  run : function(){
    var stdin = new Stdin('');
    var gm = new GrassMachine(stdin);
    gm.defun(1,[[3,4],[3,1]]);
    gm.apply(1,1);
  }
};
// }}}
// }}}

// Grass {{{
function Grass(code){ //{{{
  this.gm = new GrassMachine(new Stdin(''));
  this.code = code || "";
  this.parsed = [];
} //}}}

Grass.prototype.appendCode = function(code){ // {{{
  this.code += code;
  return this.code;
}; //}}}

Grass.prototype.parse = function(){ //{{{
  var tmp;
  var parsed = [];
  var grassIgnore = /[^wvW]*/g;
  tmp = this.code.replace(grassIgnore, '');
  tmp = tmp.split('v');
  for (var i=0; i<tmp.length;i++){
    var grp = tmp[i];
    if (grp[0] === 'w'){
      // it's a defun!
      if (grp.indexOf('W') !== -1){
        // we've got a function with some applications
        var numberOfArgs = grp.indexOf('W');
        // counting ww
        
        var apps = grp.slice(numberOfArgs)
          .replace(/wW/g,'w,W').split(',');
        // wwWwwWWWww -> [Www, WWWww]
        var commands = [];
        for(var app=0; app<apps.length; app++){
          commands.push(applicationToArray(apps[app]));
        }
        // [Www, WWWww] -> [[1,2], [3,2]]
        parsed.push(['f', numberOfArgs, commands]);
      }
      else {
        parsed.push(['f', grp.length, []]);
      }
    }
    else if (grp[0] === 'W'){
      // it's an application!
      var apps = grp.replace(/wW/g, 'w,W').split(',');
      for (var j=0; j<apps.length; j++){
        parsed.push(['a', applicationToArray(apps[j])]);
      }
    }
  }
  this.parsed = parsed;
};//}}}

Grass.prototype.run = function(){ //{{{
  this.parse();
  for (var i=0; i<this.parsed.length; i++){
    var cmd = this.parsed[i];
    if (cmd[0] === 'a'){
      this.gm.apply(cmd[1][0],cmd[1][1]);
    }
    else {
      this.gm.defun(cmd[1], cmd[2]);
    }
  }
  this.gm.apply(1,1);
  return this.gm.output;
}; //}}}

function applicationToArray(app){ //{{{
  // Www -> [1,2]
  var s = app.indexOf('w');
  return [s, app.length - s];
} //}}}
// }}}

// test {{{
var helloWorld = "\
wvwWwwwwWwwwwwwWWWWWwWWWWWwwwwvwwwwWWWwwWwwWWWWWWwwwwWwwvwWWwWwwvwwWWwvwWWWwwWW\
WWWwwwWwwWWWWWWwWWWWWWWwWWWWwWWWWWwWWWWWWwWWWWWWWWWWWWWWwwwwwwwwWwWwWWWwwWWWWww\
wwwwwWWWWWwwwwwwwWWWWWWwwwwwwwWWWWWWWWWWWWWWWWWWWWWwwwwwwwwwwwwwwwwwwwwwWwwwwww\
wwwwwwwwwwwwwwWwwwwwwwwwwwwwWwwwwwwWWwwwwwwWWWwwwwwwWWWWWWwwwwwwwwwwwwwwwwwwwwW\
wwwwwwwwwwWWwwwwWWWwwwwWWWWwWWWWWwwwwwwwwwwwwwwwwwwWWWWWWWWWWWwWwwwWWwWWWwWWWWw\
WWWWWWWWWWWWWWWWWwwwwwwwwwwwwwwwwwWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWwwwww\
wwwwwwWWwwwwwwwwwwwWWWwwwwwwwWWWWwWWWWWwwwwwwwwWWWWWWwwwwwwwwwwwwwwwwwwwwwWWWWW\
WWwwwwwwwwwwwwwwwwwwwwwwwwwwwwWWWWWWWWWwwwwwwwwWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww\
wWWwwwwwwwwwwwwwWWWwwwwwwwwwwwwwWWWWwwwwwwwwWWWWWwwwwwwwwwwwwwwwwwwwwwwwwwwWWWW\
WWwwwwwwwwwwwwwwwwwwwwwwwww";

tests.grass = {
  message : "Grass",
  run : function(){
    var grass = new Grass(helloWorld);
    grass.run();
  }
};

function runTests(){
  for (var testTask in tests){
    var test = tests[testTask];
    console.log(test.message);
    test.run();
    console.log("_____________");
  }
}

//}}}
