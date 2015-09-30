// vim: set foldmethod=indent:
/*
 * A Plex plugin for CSH DJ.
 *
 * Configuration:
 *  auth: {
 *      plex_username: "your_plex_username_here",
 *      plex_password: "your_plex_password_here",
 *      plex_client_id: "your_plex_client_id_here"
 *  }
 *
 */

var Q = require("q");
var PlexAPI = require("plex-api");
var fs = require("fs");
var request = require("request");
var uuid = require("uuid4");
var parseXMLString = require("xml2js").parseString;

var log, _auth_token, config, server_list = [], _currentBase, _currentIndex;

exports.display_name = "Plex";

function build_headers() {
    out = {
        "X-Plex-Platform" : "CSH DJ",
        "X-Plex-Platform-Version" : "0.1.0",
        "X-Plex-Provides" : "player",
        "X-Plex-Client-Identifier" : config.auth.plex_client_id || uuid(),
        "X-Plex-Product" : "CSH DJ",
        "X-Plex-Version" : "0.1.0",
        "X-Plex-Device" : "CSH DJ",
        "X-Plex-Device-Name" : "CSH DJ"
    };
    if(_auth_token) {
        out["X-Plex-Token"] = _auth_token;
    }
    return out;
}

function build_request(_url, _headers, _method) {
    return {
        url: _url,
        headers: _headers,
        method: _method
    };
}

function format_result(index, base) {
    return function(result){
        return {
            id : index + "/" + result["ratingKey"],
            title : result["title"],
            artist : result["grandparentTitle"],
            thumbnail_url : base + result["thumb"]
            //image_url : base + result["thumb"]
        };
    };
}

exports.init = function(_log, _config) {
    var deferred = Q.defer();
    log = _log;
    config = _config

    if(!config.auth) {
        deferred.reject(new Error("Please configure auth settings for Plex."));
    } else if(!config.auth.plex_username) {
        deferred.reject(new Error("Please configure Plex username."));
    } else if(!config.auth.plex_password) {
        deferred.reject(new Error("Please configure Plex password."));
    } else {
        var auth_request = build_request(
            "https://plex.tv/users/sign_in.json",
            build_headers(),
            "POST"
        );
        request(auth_request, function(err, response, body) {
            if(err) {
                deferred.reject(err);
                return;
            }
            _auth_token = JSON.parse(body)["user"]["authentication_token"]
            var servers_request = build_request(
                "https://plex.tv/pms/servers.xml",
                build_headers(),
                "GET"
            );
            request(servers_request, function(err, response, body) {
                if(err) {
                    deferred.reject(err);
                    return;
                }
                parseXMLString(body, function(err, result) {
                    if(err) {
                        deferred.reject(err);
                        return;
                    }
                    result['MediaContainer']['Server'].forEach(
                        function(currentValue, index, array) {
                            plexConstructor = {
                                hostname : currentValue['$']['address'],
                                port : currentValue['$']['port'],
                                token : _auth_token,
                                options: {
                                    identifier: config.auth.plex_client_id,
                                    product: "CSH DJ Plex Plugin",
                                    version: "0.1.0",
                                    deviceName: "CSH DJ"
                                }
                            };
                            server_list.push(new PlexAPI(plexConstructor));
                    });
                    deferred.resolve();
                });
            });
        }).auth(config.auth.plex_username, config.auth.plex_password, true);
    }
    return deferred.promise;
}

exports.search = function(max_results, query) {
    var deferred = Q.defer();
    server_list.forEach(function(currentValue, index, array) {
        _currentBase = currentValue["hostname"] + ":" + currentValue["port"]
        _currentIndex = index;
        currentValue.find("/library/sections", {type : "artist"}).then(
            function(directories) {
                directories.forEach(function(_currentValue, _index, array) {
                    currentValue.find(
                        _currentValue["uri"] + "/search?type=10&query=" + 
                        query).then(
                            function(dirs) {
                                deferred.resolve(dirs.slice(0, max_results)
                                                     .map(format_result(index,
                                                             currentValue)));
                            },
                            function(err) {
                                deferred.reject(err);
                            }
                        );
                });
            },
            function(err) {}
        );
    });
    return deferred.promise;
}

exports.fetch = function(id, download_location) {
    var deferred = Q.defer();
    var util = require("util");
    server = server_list[id.split("/")[0]];
    song_id = id.split("/")[1];
    log("server: " + util.inspect(server));
    log("song_id: " + song_id);
    server.find("/library/metadata/" + song_id).then(
        function(directories) {
            // I'm so sorry
            var song_path = directories[0]["_children"][0]["_children"][0]["key"];
            log(song_path);
            var download_path = download_location + song_path.split("/")
                                                             .slice(-1);
            log(download_path);
            var write_stream = fs.createWriteStream(download_path);
            //var request_opts = {
            //    uri : "https://" + server["host"] + ":" + server["port"] + "/" + song_path,
            //    headers: build_headers(),
            //    method: "GET",
            //    encoding: null
            //};
            //request(request_opts, function(err, msg, songdata) {
            //    if(err) {
            //        deferred.reject(err);
            //        return;
            //    }

            //    ws.write(songdata);
            //    deferred.resolve(download_path);
            //});
            server.query(song_path).then(
                function(result) {
                    write_stream.write(result);
                    deferred.resolve(download_path);
                },
                function(err) {
                    deferred.reject(err);
                }
            );
        },
        function(err) {
            deferred.reject(err);
        }
    );

    return deferred.promise;
}
