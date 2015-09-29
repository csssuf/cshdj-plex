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

var log, _auth_token, config;

exports.display_name = "Plex";

function build_headers() {
    return {
        "X-Plex-Platform" : "CSH DJ",
        "X-Plex-Platform-Version" : "0.1.0",
        "X-Plex-Provides" : "player",
        "X-Plex-Client-Identifier" : config.auth.plex_client_id || uuid(),
        "X-Plex-Product" : "CSH DJ",
        "X-Plex-Version" : "0.1.0",
        "X-Plex-Device" : "CSH DJ",
        "X-Plex-Device-Name" : "CSH DJ"
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
        var plex_headers = build_headers();
        var req_opts = {
            url : "https://plex.tv/users/sign_in.json",
            headers : plex_headers,
            method: "POST"
        }
        request(req_opts, function(err, response, body) {
            if(err) {
                deferred.reject(new Error(err));
                return;
            }

            _auth_token = JSON.parse(body)["user"]["authentication_token"]
            log(_auth_token);
        }).auth(config.auth.plex_username, config.auth.plex_password, true);
    }
}

exports.search = function(max_results, query) { return []; }

exports.fetch = function(id, download_location) { return; }
