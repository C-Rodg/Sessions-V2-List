import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';
import { Http, Headers } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/forkJoin'
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/observable/of';
import * as moment from 'moment';

@Injectable()
export class EventsService {

    constructor(private http: Http, private toastCtrl: ToastController) {

    }

    // Check for updates to an event
    // 1. Login, 2. Get BundleHash, 3. DownloadContent, resolve
    // ^^^^^>> 1A. InitateChallenge, 1B. ComputeHash, 1C. ValidateChallenge
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