import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/forkJoin'
import 'rxjs/add/operator/mergeMap';
import * as moment from 'moment';

@Injectable()
export class EventsService {

    constructor(private http: Http) {

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
}