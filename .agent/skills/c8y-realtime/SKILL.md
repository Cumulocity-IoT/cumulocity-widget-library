---
name: c8y-realtime
description: Instructions for implementing real-time data updates in Cumulocity UI components using the RealtimeService and its variants. Use when adding real-time capabilities to the UI.
---

The `RealtimeService` is a generic abstract class which implements the interactions with the
real-time API.

There are multiple classes based on this class to match the different real-time channels. These are
for example:

- `AlarmRealtimeService`
- `AuditRealtimeService`
- `EventRealtimeService`
- `MeasurementRealtimeService`
- `OperationRealtimeService`
- `ManagedObjectRealtimeService`

### Usage Example

```typescript
import { Component, inject } from '@angular/core';
import { AlarmRealtimeService } from '@c8y/ngx-components';

@Component({
  selector: 'my-alarm-realtime-btn',
  template: `<button (click)="alarmRealtime.subscribe()">Subscribe</button>`,
  providers: [AlarmRealtimeService]
})
export class MyAlarmRealtimeBtnComponent {
  alarmRealtime = inject(AlarmRealtimeService);
}
```

This approach allows users to control the subscription via the UI, while you can still subscribe to updates in your component logic as needed.

For a more advanced example, see the tutorial component below, which demonstrates how to combine multiple realtime services and manage their subscriptions programmatically.
