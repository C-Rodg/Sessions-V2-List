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

    constructor(private http: Http, private toastCtrl: ToastController) { }

    // Scanned QR code, load event
    // 1.) Parse Configuration Key, 2.) Load Existing Event, 3.) Get Discovery REST URL, 4.) Get Login REST URL, 5.) Get Session REST URL, 6.) Get Access Control REST URL
    // 7.) Login*, 8.) Get Event Info, 9.) Create or Update Event, 10.) Save Session Token, 11.) Download Content, 12.) Load Session List*
    // Login>^^^^^>> 7A.) InitateChallenge, 7B.) ComputeHash, 7C.) ValidateChallenge
    // Load Session List>^^^^^>> 12A.) Fetch Session List, 12B.) Save Session List
    loadEventFromKey(key) {
        return this.parseConfigurationKey(key).flatMap((r1) => {
            if (r1['error']) {
                this.showToast(r1['msg'], true);
                Observable.throw(r1);
            }
            return this.loadExistingEvent(r1);
        }).flatMap((r2) => {
            if (r2['error']) {  
                this.showToast(r2['msg'], true);          
                Observable.throw(r2);
            }
            return this.getDiscoveryRestUrl(r2);
        }).flatMap((r3) => {
            if (r3['error']) {
                this.showToast(r3['msg'], true);
                Observable.throw(r3);
            }
            return this.getLoginRestUrl(r3);
        }).flatMap((r4) => {
            if (r4['error']) {
                this.showToast(r4['msg'], true);
                Observable.throw(r4);
            }
            return this.getSessionRestUrl(r4);
        }).flatMap((r5) => {
            if (r5['error']) {
                this.showToast(r5['msg'], true);
                Observable.throw(r5);
            }
            return this.getAccessControlRestUrl(r5);
        }).flatMap((r6) => {
            if (r6['error']) {
                this.showToast(r6['msg'], true);
                Observable.throw(r6);
            }
            return this.login(r6);
        }).flatMap((r7) => {
            if (r7['error']) {
                this.showToast(r7['msg'], true);
                Observable.throw(r7);
            }
            return this.getEventInfo(r7);
        }).flatMap((r8) => {
            if (r8['error']) {
                this.showToast(r8['msg'], true);
                Observable.throw(r8);
            }
            return this.createOrUpdateEvent(r8);
        }).flatMap((r9) => {
            if (r9['error']) {
                this.showToast(r9['msg'], true);
                Observable.throw(r9);
            }
            return this.saveSessionToken(r9);
        }).flatMap((r10) => {
            if (r10['error']) {
                this.showToast(r10['msg'], true);
                Observable.throw(r10);
            }
            this.showToast('Downloading content...', false);
            return this.downloadContent(r10);
        }).flatMap((r11) => {
            if (r11['error']) {
                this.showToast(r11['msg'], true);
                Observable.throw(r11);
            }            
            return this.loadSessionList(r11);
        });
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
        return this.http.get(`${context.DiscoveryRestUrl}/ApplicationUrls/ExternalLoginService?versionMajor=1&versionMinor=0&urlTypes=rest`).map(res => res.json()).map((r) => {
            context.LoginRestUrl = null;
            if (r.ApplicationResults.length != 1) {}
            else {
                if (r.ApplicationResults[0].ApplicationUrls.length != 1) {}
                else {
                    context.LoginRestUrl = r.ApplicationResults[0].ApplicationUrls[0].Url;
                }
            }

            if (context.LoginRestUrl != null) {
                return context;
            } else {
                return {
                    error: true,
                    msg: 'Invalid response from login URL service...'
                };
            }
        });
    }

    // Get session URL (load #5)
    getSessionRestUrl(context) {
        return this.http.get(`${context.DiscoveryRestUrl}/ApplicationUrls/ExternalSessionService?versionMajor=2&versionMinor=0&urlTypes=rest`).map(res => res.json()).map((r) => {
            context.SessionRestUrl = null;
            if (r.ApplicationResults.length != 1) {}
            else {
                if (r.ApplicationResults[0].ApplicationUrls.length != 1) {}
                else {
                    context.SessionRestUrl = r.ApplicationResults[0].ApplicationUrls[0].Url;
                }
            }

            if (context.SessionRestUrl != null) {
                return context;
            } else {
                return {
                    error: true,
                    msg: "Invalid response from session URL service..."
                };
            }
        });
    }

    // Get access control URL (load #6) 
    getAccessControlRestUrl(context) {
        return this.http.get(`${context.DiscoveryRestUrl}/ApplicationUrls/ExternalAccessControlService?versionMajor=1&versionMinor=0&urlTypes=rest`).map(res => res.json()).map((r) => {
            context.AccessControlRestUrl = null;
            if (r.ApplicationResults.length != 1) {}
            else {
                if (r.ApplicationResults[0].ApplicationUrls.length != 1) {}
                else {
                    context.AccessControlRestUrl = r.ApplicationResults[0].ApplicationUrls[0].Url;
                }
            }

            if (context.AccessControlRestUrl != null) {
                return context;
            } else {
                return {
                    error: true,
                    msg: 'Invalid response from access control URL service...'
                };
            }
        });
    }

    // Get Event Info (load #8) 
    getEventInfo(context) {
        let headers = new Headers();
        headers.append('Authorization', `ValidarSession token="${context.SessionToken}"`);
        return this.http.get(`${context.SessionRestUrl}/GetEventInfo/${context.configurationKey.configuration.eventGuid}`, {headers}).map(res => res.json()).map((r) => {
            context.EventInfo = r;
            return context;
        });
    }

    // Create or Update Event (load #9)
    createOrUpdateEvent(context) {
        if (!context.event) {
            context.event = {};
        }
        context.event.Name = context.EventInfo.Name;
        context.event.City = context.EventInfo.City;
        context.event.State = context.EventInfo.StateProvince;
        context.event.Venue = context.EventInfo.Venue;
        context.event.StartDate = context.EventInfo.StartDate ? new Date(context.EventInfo.StartDate) : null;
        context.event.EndDate = context.EventInfo.EndDate ? new Date(context.EventInfo.EndDate) : null;
        context.event.Revision = context.configurationKey.revision;
        context.event.DiscoveryUrl = context.DiscoveryRestUrl;
        context.event.SessionUrl = context.SessionRestUrl;
        context.event.AccessControlUrl = context.AccessControlRestUrl;
        context.event.LoginUrl = context.LoginRestUrl;
        context.event.AuthCode = context.configurationKey.configuration.authCode;
        context.event.AuthGuid = context.configurationKey.configuration.authGuid;
        context.event.BundleGuid = null;
        context.event.BundleVersionGuid = null;
        context.event.BundleHash = null;

        return this.http.put(`http://localhost/events/${context.configurationKey.configuration.eventGuid}`, JSON.stringify(context.event)).map(res => res.json()).map((r) => {
            if (!r || r.Fault) {
                return {
                    error: true,
                    msg: r ? r.Fault.Type : 'Invalid response while creating event...'
                };
            }
            return context;
        });
    }

    // Save Session Token (load #10)
    saveSessionToken(context) {
        const sessionToken = {
            SessionToken: context.SessionToken
        };
        return this.http.put(`http://localhost/events/${context.configurationKey.configuration.eventGuid}/sessiontoken`, JSON.stringify(sessionToken)).map(res => res.json()).map((r) => {
            return context;
        });
    }

    // Load Session List (load #12)
    // >>>>> 12A.) fetchSessionList, 12B.) saveSessionList
    loadSessionList(context) {
        const args = {
            SessionRestUrl: context.SessionRestUrl,
            EventGuid: context.configurationKey.configuration.eventGuid,
            SessionToken: context.SessionToken
        };

        return this.fetchSessionList(args).flatMap((d) => {
            if (d.error) {
                Observable.throw(d);
            } else {
                return this.saveSessionlist(d);
            }
        })
    }

    // Fetch Session List (load #12A)
    fetchSessionList(args) {
        let headers = new Headers();
        headers.append('Authorization', `ValidarSession token="${args.SessionToken}"`);
        return this.http.get(`${args.SessionRestUrl}/ListAttendanceTrackingScheduleItemSessions/${args.EventGuid}`, {headers}).map(res => res.json()).map((r) => {
            if (r.Fault) {
                return {
                    error: true,
                    msg: r.Fault.Type
                };
            } else {
                args.ScheduleItemSessions = r.ScheduleItemSessions;
                return args;
            }
        });
    }

    // Save Session List (load #12B)
    saveSessionlist(args) {
        args.ScheduleItemSessions.forEach((sched) => {
            sched.StartDateTime = sched.StartDateTime ? new Date(sched.StartDateTime + "Z") : null;
            sched.EndDateTime = sched.EndDateTime ? new Date(sched.EndDateTime + "Z") : null;
            sched.SessionGuid = sched.ScheduleItemGuid;
            sched.SessionKey = sched.ScheduleItemKey;
        });

        return this.http.put(`http://localhost/events/${args.EventGuid}/sessions`, JSON.stringify(args.ScheduleItemSessions)).map(res => res.json()).map((r) => {
            if (r.Fault) {
                return {
                    error: true,
                    msg: r.Fault.Type
                };
            }
            return args;
        });
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

    // Download new content (login #3 / load #11)
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