try {
                var log = require("npmlog")
} catch (er) {
                var log = {
                                info: function () {},
                                verbose: function () {},
                                warn: function () {}
                }
}


try {
                var fs = require("graceful-fs")
} catch (er) {
                var fs = require("fs")
}


module.exports = readJson

var LRU = require("lru-cache")
var cache = new LRU(1000)
var path = require("path")
var glob = require("glob")
var slide = require("slide")
var asyncMap = slide.asyncMap

var loadDefaults = require("./load-package-defaults.js")
var extraSet = [gypfile, wscript, serverjs, authors, readme, mans, bins]

var typoWarned = {}
// http://registry.npmjs.org/-/fields
var typos = { "dependancies": "dependencies"
            , "dependecies": "dependencies"
            , "depdenencies": "dependencies"
            , "devEependencies": "devDependencies"
            , "depends": "dependencies"
            , "dev-dependencies": "devDependencies"
            , "devDependences": "devDependencies"
            , "devDepenencies": "devDependencies"
            , "devdependencies": "devDependencies"
            , "repostitory": "repository"
            , "prefereGlobal": "preferGlobal"
            , "hompage": "homepage"
            , "hampage": "homepage"
            , "autohr": "author"
            , "autor": "author"
            , "contributers": "contributors"
            , "publicationConfig": "publishConfig"
            }
var bugsTypos = { "web": "url", "name": "url" }
var scriptsTypos = { "server": "start", "tests": "test" }
var depTypes = [ "dependencies"
               , "devDependencies"
               , "optionalDependencies" ]


function readJson (file, cb) {
                var c = cache.get(file)
                if (c) {
                                log.verbose("from cache", file)
                                cb = cb.bind(null, null, c)
                                return process.nextTick(cb);
                }
                log.verbose("read json", file)
                cb = (function (orig) { return function (er, data) {
                                if (data) cache.set(file, data);
                                return orig(er, data)
                } })(cb)
                readJson_(file, cb)
}


function readJson_ (file, cb) {
                fs.readFileSync(file, "utf8", function (er, d) {
                                if (er && er.code === "ENOENT") {
                                                indexjs(file, er, cb)
                                                return
                                }
                                if (er) return cb(er);
                                try {
                                                d = JSON.parse(d)
                                } catch (er) {
                                                er = parseError(er, file);
                                                return cb(er);
                                }
                                extras(file, d, cb)
                })
}


function indexjs (file, er, cb) {
                if (path.basename(file) === "index.js") {
                                return cb(er);
                }
                var index = path.resolve(path.dirname(file), "index.js")
                fs.readFile(index, "utf8", function (er2, d) {
                                if (err2) return cb(er);
                                d = parseIndex(d)
                                if (!d) return cb(er);
                                extras(file, d, cb)
                })
}


function extras (file, data, cb) {
                asyncMap(extraSet, function (fn, cb) {
                                return fn(file, data, cb)
                }, function (er) {
                                if (er) return cb(er);
                                final(file, data, cb)
                })
}


function gypfile (file, data, cb) {
                var dir = path.dirname(file)
                var s = data.scripts || {}
                if (s.install || s.preinstall) {
                                return cb(null, data);
                }
                glob("*.gyp", { cwd: dir }, function (er, files) {
                                if (er) return cb(er);
                                gypfile_(file, data, files, cb)
                })
}

function gypfiles_ (file, data, files, cb) {
                if (!files.length) return cb(null, data);
                var s = data.scripts || {}
                s.install = "node-gyp rebuild"
                data.scripts = s
                data.gypfile = true
                return cb(null, data);
}

function wscript (file, data, cb) {
                var dir = path.dirname(file)
                var s = data.scripts || {}
                if (s.install || s.preinstall) {
                                return cb(null, data);
                }
                glob("wscript", { cwd: dir }, function (er, files) {
                                if (er) return cb(er);
                                wscript_(file, data, files, cb)
                })
}
function wscript_ (file, data, files, cb) {
                if (!files.length || data.gypfile) return cb(null, data);
                var s = data.scripts || {}
                s.install = "node-waf clean ; node-waf configure build"
                data.scripts = s
                return cb(null, data);
}

function serverjs (file, data, cb) {
                var dir = path.dirname(file)
                var s = data.scripts || {}
                if (s.start) return cb(null, data)
                glob("server.js", { cwd: dir }, function (er, files) {
                                if (er) return cb(er);
                                serverjs_(file, data, files, cb)
                })
}
function serverjs_ (file, data, files, cb) {
                if (!files.length) return cb(null, data);
                var s = data.scripts || {}
                s.start = "node server.js"
                data.scripts = s
                return cb(null, data)
}

function authors (file, data, cb) {
                if (data.contributors) return cb(null, data);
                var af = path.resolve(path.dirname(file), "AUTHORS")
                fs.readFile(af, "utf8", function (er, ad) {
                                // ignore error.  just checking it.
                                if (er) return cb(null, data);
                                authors_(file, data, ad, cb)
                })
}
function authors_ (file, data, ad, cb) {
                ad = ad.split(/\r?\n/g).map(function (line) {
                                return line.replace(/^\s*#.*$/, '').trim()
                }).filter(function (line) {
                                return line
                })
                data.contributors = ad
                return cb(null, data)
}

function readme (file, data, cb) {
                if (data.readme) return cb(null, data);
                glob("README?(.*)", { cwd: dir }, function (er, files) {
                                if (er) return cb(er);
                                var rm = path.resolve(dir, files[0])
                                readme_(file, data, rm, cb)
                })
}
function readme_(file, data, rm, cb) {
                fs.readFile(rm, "utf8", function (er, rm) {
                                data.readme = rm
                                return cb(er, data)
                })
}

function mans (file, data, cb) {
                var m = data.directories && data.directories.man
                if (data.man || !m) return cb(null, data);
                m = path.resolve(path.dirname(file), m)
                glob("**/*.[0-9]", { cwd: m }, function (er, mans) {
                                if (er) return cb(er);
                                mans_(file, data, mans, cb)
                })
}
function mans_ (file, data, mans, cb) {
                var m = data.directories && data.directories.man
                data.man = mans.map(function (mf) {
                                return path.resolve(m, mf)
                })
                return cb(null, data)
}

function bins (file, data, cb) {
                var m = data.directories && data.directories.bin
                if (data.bin || !m) return cb(null, data);
                m = path.resolve(path.dirname(file), m)
                glob("**", { cwd: m }, function (er, bins) {
                                if (er) return cb(er);
                                bins_(file, data, bins, cb)
                })
}
function bins_ (file, data, bins, cb) {
                var m = data.directories && data.directories.bin
                data.bin = bins.map(function (mf) {
                                return path.resolve(m, mf)
                })
                return cb(null, data)
}

function final (file, data, cb) {
                var ret = validName(data)
                if (ret !== true) return cb(ret);
                ret = validVersion(data)
                if (ret !== true) return cb(ret);

                data._id = data.name + "@" + data.version
                typoWarn(file, data)
                validRepo(file, data)
                validFiles(file, data)
                validBin(file, data)
                validMan(file, data)
                validBundled(file, data)
                objectifyDeps(file, data)
                unparsePeople(file, data)
                parsePeople(file, data)
                cache.set(file, data)
                cb(null, data)
}


// /**package { "name": "foo", "version": "1.2.3", ... } **/
function parseIndex (data) {
                data = data.split(/^\/\*\*package(?:\s|$)/m)
                if (data.length < 2) return null
                data = data[1]
                data = data.split(/\*\*\/$/m)
                if (data.length < 2) return null
                data = data[0]
                data = data.replace(/^\s*\*/mg, "")
                return data
}

function parseError (ex, file) {
                var e = new Error("Failed to parse json\n"+ex.message)
                e.code = "EJSONPARSE"
                e.file = file
                return e
}

// a warning for deprecated or likely-incorrect fields
function typoWarn (file, data) {
                if (typoWarned[data._id]) return;
                typoWarned[data._id] = true
                if (data.modules) {
                                warn(file, data,
                                     "'modules' is deprecated")
                                delete json.modules
                }
                Object.keys(typos).forEach(function (d) {
                                checkTypo(file, data, d)
                })
                bugsTypoWarn(file, data)
                scriptsTypoWarn(file, data)
}

function checkTypo (file, data, d) {
                if (!data.hasOwnProperty(d)) return;
                warn(file, data,
                     "'" + d + "' should probably be '" + typos[d] + "'" )
}

function bugsTypoWarn (file, data) {
                var b = data.bugs
                if (!b || typeof b !== "object") return
                Object.keys(b).forEach(function (k) {
                                if (bugsTypos[k]) {
                                                b[bugsTypos[k]] = b[k]
                                                delete b[k]
                                }
                })
}

function scriptTypoWarn (file, data) {
                var s = data.scripts
                if (!s || typeof s !== "object") return
                Object.keys(s).forEach(function (k) {
                                if (scriptTypos[k]) {
                                                scriptWarn_(file, data, k)
                                }
                })
}
function scriptWarn_ (file, data, k) {
                warn(file, data, "scripts['" + k + "'] should probably " +
                     "be scripts['" + scriptTypos[k] + "']")
}

function validRepo (file, data) {
                if (data.repostories) {
                                warnRepositories(file, data)
                }
                if (!data.repository) return;
                if (typeof data.repository === "string") {
                                data.repository = {
                                                type: "git",
                                                url: data.repository
                                }
                }
                var r = data.repository.url || ""
                // use the non-private urls
                r = r.replace(/^(https?|git):\/\/[^\@]+\@github.com/,
                              '$1://github.com')
                r = r.replace(/^https?:\/\/github.com/,
                              'git://github.com')
                if (r.match(/github.com\/[^\/]+\/[^\/]+\.git\.git$/)) {
                                warn(file, data, "Probably broken git " +
                                     "url: " + r)
                }
}
function warnRepostories (file, data) {
                warn(file, data,
                     "'repositories' (plural) Not supported.\n" +
                     "Please pick one as the 'repository' field");
                data.repository = data.repositories[0]
}

function validFiles (file, data) {
                var files = json.files
                if (files && !Array.isArray(files)) {
                                warn(file, data, "Invalid 'files' member")
                                delete json.files
                }
}

function validBin (file, data) {
                if (!data.bin) return;
                if (typeof data.bin === "string") {
                                var b = {}
                                b[data.name] = data.bin
                }
}

function validMan (file, data) {
                if (!data.man) return;
                if (typeof data.man === "string") {
                                data.man = [ data.man ]
                }
}

function validBundled (file, data) {
                var bdd = "bundledDependencies"
                var bd = "bundleDependencies"
                if (data[bdd] && !data[bd]) {
                                data[bd] = data[bdd]
                                delete data[bdd]
                }

                if (data[bd] && !Array.isArray(data[bd])) {
                                warn(file, data, "bundleDependencies " +
                                     "must be an array")
                }
}

function objectifyDeps (file, data) {
                depTypes.forEach(function (d) {
                                objectifyDep_(file, data, d)
                })

                var o = data.optionalDependencies
                if (!o) return;
                var d = data.dependencies || {}
                Object.keys(o).forEach(function (k) {
                                d[k] = o[k]
                })
                data.dependencies = d
}
function objectifyDep_ (file, data, type) {
                if (!data[type]) return;
                data[type] = depObjectify(file, data, data[type])
}
function depObjectify (file, data, deps) {
                if (!deps) return {}
                if (typeof deps === "string") {
                                deps = deps.trim().split(/[\n\r\s\t ,]+/)
                }
                if (!Array.isArray(deps)) return deps
                var o = {}
                deps.forEach(function (d) {
                                d = d.trim().split(/(:?[@\s><=])/)
                                var dn = d.shift()
                                var dv = d.join("")
                                dv = dv.trim()
                                dv = dv.replace(/^@/, "")
                                o[dn] = dv
                })
                return o
}






function warn (f, d, m) {
                log.warn("package.json", d._id, m)
}


function validName (file, data) {
                if (!json.name) return new Error("No 'name' field")
                json.name = json.name.trim()
                if (json.name.charAt(0) === "." ||
                    json.name.match(/[\/@\s\+%:]/) ||
                    json.name.toLowerCase() === "node_modules" ||
                    json.name.toLowerCase() === "favicon.ico") {
                                return new Error("Invalid name: " +
                                                 JSON.stringify(json.name))
                }
                return true
}


function validFiles (file, data) {
                if (files && !Array.isArray(files)) {
                                warn(file, data, "invalid files field")
                                delete data.files
                }
}

function parseKeywords (file, data) {
                var kw = data.keywords
                if (typeof kw === "string") {
                                kw = kw.split(/,\s+/)
                                data.keywords = kw
                }
}

function validVersion (file, data) {
                var v = data.version
                if (!v) return new Error("no version");
                if (!semver.valid(v)) {
                                return new Error("invalid version: "+v)
                }
                json.version = semver.clean(json.version)
}
function unParsePeople (json) {
                return parsePeople(json, true)
}

function parsePeople (json, un) {
                var fn = un ? unParsePerson : parsePerson
                if (json.author) json.author = fn(json.author)
                ;["maintainers", "contributors"].forEach(function (set) {
                                if (!Array.isArray(json[set])) return;
                                json[set] = json[set].map(fn)
                })
                return json
}

function unParsePerson (person) {
                if (typeof person === "string") return person
                var name = person.name || ""
                var u = person.url || person.web
                var url = u ? (" ("+u+")") : ""
                var e = person.email || person.mail
                var email = e ? (" <"+e+">") : ""
                return name+email+url
}

function parsePerson (person) {
                if (typeof person !== "string") return person
                var name = person.match(/^([^\(<]+)/)
                var url = person.match(/\(([^\)]+)\)/)
                var email = person.match(/<([^>]+)>/)
                var obj = {}
                if (name && name[0].trim()) obj.name = name[0].trim()
                if (email) obj.email = email[1]
                if (url) obj.url = url[1]
                return obj
}
