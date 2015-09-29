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

var log, _auth_token, config, server_list;

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
            log(_auth_token);
        }).auth(config.auth.plex_username, config.auth.plex_password, true);
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
                            username : config.auth.plex_username,
                            password : config.auth.plex_password,
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
    }
    return deferred.promise;
}

exports.search = function(max_results, query) { return []; }

exports.fetch = function(id, download_location) { return; }
