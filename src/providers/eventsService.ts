import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import { Http, Headers } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/forkJoin'
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/observable/of';
import * as moment from 'moment';
import { CONFIGURATION_KEY_PASSCODE, EVENT_SESSION_TRACKING_CONFIGURATION_KEY_TYPE } from '../secrets/secrets';

@Injectable()
export class EventsService {

    constructor(private http: Http, private toastCtrl: ToastController) {

    }

    // TODO: START HERE___!!!!
    // Scanned QR code, load event
    // 1.) Parse Configuration Key, 2.) Load Existing Event, 3.) Get Discovery REST URL, 4.) Get Login REST URL, 5.) Get Session REST URL, 6.) Get Access Control REST URL
    // 7.) Login*, 8.) Get Event Info, 9.) Confirm Adding Event??, 10.) Create or Update Event, 11.) Save Session Token, 12.) Download Content, 13.) Load Session List
    // Login>^^^^^>> 7A. InitateChallenge, 7B. ComputeHash, 7C. ValidateChallenge
    loadEventFromKey(key) {
        // TODO: CHECK FOR ERRORS IN FLATMAPS
    }

    // Parse Configuration Key (load #1)
    parseConfigurationKey(k) {
        let req = {
            passcode: CONFIGURATION_KEY_PASSCODE,
            data: k
        };
        return this.http.post(`http://localhost/configurationkey/parse`, JSON.stringify(req)).map(res => res.json()).map((r) => {
            if (r.entity.toUpperCase() != EVENT_SESSION_TRACKING_CONFIGURATION_KEY_TYPE) {
                return {
                    error: true,
                    msg : 'Incorrect type of configuration key...'
                };
            } else {
                const expire = Date.parse(r.expirationDateTimeUtc);
                if (expire < Date.now()) {
                    return {
                        error: true,
                        msg: 'Configuration key has expired...'
                    };
                } else {
                    let context = {
                        configurationKey: r
                    };
                    context.configurationKey.revision = parseInt(context.configurationKey.revision);
                    return context;
                }
            }
        });
    }

    // Attempt to load event from local database (load #2)
    loadExistingEvent(context) {
        return this.http.get(`http://localhost/events/${context.configurationKey.configuration.eventGuid}`).map(res => res.json()).map((r) => {
            if (r.Fault) {
                if (r.Fault.Type == 'NotFoundFault') {
                    context.event = null;
                    return context;
                } else {
                    return {
                        error: true,
                        msg: r.Fault.Type
                    };
                }
            } else {
                // Lead source was previously loaded
                if (context.configurationKey.revision <= r.Event.Revision) {
                    return {
                        error: true,
                        msg: "Invalid revision of configuration key..."
                    };
                } else {
                    context.event = r.Event;
                    return context;
                }
            }
        });
    }

    // Get the discovery url (load #3)
    getDiscoveryRestUrl(context) {
        return this.http.get(`${context.configurationKey.configuration.discoverUrl}?urlTypes=rest&versionMajor=1&versionMinor=0`).map(res => res.json()).map((r) => {
            context.DiscoveryRestUrl = null;
            if (r.ApplicationResults.length != 1) {}
            else {
                if (r.ApplicationResults[0].ApplicationUrls.length != 1) {}
                else {
                    context.DiscoveryRestUrl = r.ApplicationResults[0].ApplicationUrls[0].Url;
                }
            }

            if (context.DiscoveryRestUrl != null) {
                return context;
            } else {
                return {
                    error: true,
                    msg: 'Invalid response from discovery URL service...'
                };
            }
        });
    }

    // Get login URL (load #4)
    getLoginRestUrl(context) {
        // TODO: COMPLETE SERVICE...
    }

    // Check for updates to an event
    // 1.) Login*, 2.) Get BundleHash, 3.) DownloadContent, resolve
    // Login>^^^^^>> 1A.) InitateChallenge, 1B.) ComputeHash, 1C.) ValidateChallenge
    checkForUpdates(event) {
        let ev = this.cleanEvent(event);
        let context = {
            event: ev,
            EventGuid: ev.EventGuid,
            authCode: ev.AuthCode,
            authGuid: ev.AuthGuid,
            LoginRestUrl: ev.LoginUrl,
            SessionRestUrl: ev.SessionUrl
        };
        return this.login(context).flatMap((a)=>this.getBundleHash(a)).flatMap((b) => {
            if (b.sameContent) {
                this.showToast('Content is already up-to-date.', false);
                return Observable.of(null);
            }
            this.showToast("Downloading update...", false);
            return this.downloadContent(b);
        });
    }  

    // Login to Validar Services
    login(context) {
        let loginArgs = {
            loginRestUrl: context.LoginRestUrl
        };
        loginArgs['authCode'] = context.authCode ? context.authCode : context.configurationKey.configuration.authCode;
        loginArgs['authGuid'] = context.authCode ? context.authGuid : context.configurationKey.configuration.authGuid;

        return this.initiateChallenge(loginArgs).flatMap((a)=>this.computeHash(a)).flatMap((b)=>this.validateChallenge(b)).flatMap((loginResult) => {
            context.SessionToken = loginResult.SessionToken;
            return Observable.of(context);
        });
    }  

    // Initate Challenge (login #1A)
    initiateChallenge(loginArgs) {
        this.showToast('Logging in...', false);        
        return this.http.post(`${loginArgs.loginRestUrl}/InitiateChallenge/${loginArgs.authGuid}`, {}).map(res => res.json()).map((r) => {
            loginArgs.challenge = r;
            return loginArgs;
        });
    }

    // Compute Hash (login #1B)
    computeHash(loginArgs) {
        let req = {
            authcode: loginArgs.authCode,
            nonce: loginArgs.challenge.Nonce
        };
        return this.http.post(`http://localhost/digestauthentication/computehash`, JSON.stringify(req)).map(res => res.json()).map((r) => {
            loginArgs.hash = r.Hash;
            return loginArgs;
        });
    }

    // Validate Challenge (login #1C)
    validateChallenge(loginArgs) {
        let urlHash = loginArgs.hash.replace(/\//g, '_');
        urlHash = urlHash.replace(/\+/g, '-');
        return this.http.post(`${loginArgs.loginRestUrl}/ValidateChallenge/${loginArgs.challenge.ChallengeGuid}/${encodeURIComponent(urlHash)}`, {}).map(res => res.json()).map((r) => {
            let loginResult = {
                SessionToken: r.SessionToken
            };
            return loginResult;
        });
    }

    // Get Bundle Hash (login #2)
    getBundleHash(context) {
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Authorization', `ValidarSession token="${context.SessionToken}"`);
        return this.http.get(`${context.SessionRestUrl}/GetBundleHash/${context.event.EventGuid}`, {headers}).map(res => res.json()).map((r) => {
            if (r.Hash != context.event.BundleHash) {
                return context;
            } else {
                return {
                    sameContent: true
                };
            }
        });
    }

    // Download new content (login #3)
    downloadContent(context) {
        let req = {
            EventGuid: context.EventGuid ? context.EventGuid : context.configurationKey.configuration.eventGuid,
            SessionUrl: context.SessionRestUrl,
            SessionToken: context.SessionToken
        };
        return this.http.post(`http://localhost/bundle/getbundle`, JSON.stringify(req)).map(res => res.json()).map((r) => {
            return context;
        });
    }

    // Delete an event
    deleteEvent(eg) {
        return this.http.delete(`http://localhost/events/${eg}`).map(d => d.json());
    }

    // Get Events with display dates, pending and total counts
    getEvents() {
        return this.allEvents().flatMap((events) => {
            let totalBatch = [];
            events.forEach((event, i) => {
                totalBatch.push(Observable.forkJoin(this.getScanCount(event.EventGuid, ''), this.getScanCount(event.EventGuid, 'uploaded=no&error=no')).map((rez) => {
                    events[i].TotalCount = rez[0].Count;
                    events[i].PendingCount = rez[1].Count;
                    const start = moment(events[i].StartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
                    const end = moment(events[i].EndDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ');
                    events[i].DisplayDate = `${start.format('ddd, MMM Do')} - ${end.format('ddd, MMM Do, YYYY')}`;
                    return events[i];
                }));
            });  
            return Observable.forkJoin(totalBatch);          
        });
    }

    // Clean Event
    cleanEvent(event) {
        delete event.TotalCount;
        delete event.PendingCount;
        delete event.DisplayDate;
        return event;
    }

    // Return local events
    allEvents() {
        return this.http.get('http://localhost/events').map(d => d.json()).map(d => d.Events);
    }

    // Get Total or Pending Count for an event
    getScanCount(eg, opts) {
        return this.http.get(`http://localhost/events/${eg}/sessions/scans/count?${opts}`).map(d => d.json());
    }

    // Get Client info 
    getClientInfo() {
        return this.http.get('http://localhost/clientinfo').map(d => d.json());
    }

    // Helper - Show notification
    showToast(msg, isError) {
        let toast = this.toastCtrl.create({
        message: msg,
        duration: 3000,
        position: 'top',
        cssClass: isError ? 'error-notify' : ''
        });
        toast.present();
    }
}