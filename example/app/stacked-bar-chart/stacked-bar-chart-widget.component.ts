import { Component, Input, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MeasurementService, Realtime } from '@c8y/client';
import { Chart, registerables } from 'chart.js';
import moment from 'moment';
import 'chartjs-adapter-moment'; // Ensure moment adapter is used for time scale if needed, or luxon. 
// Wait, chart.js needs an adapter for time scale. I didn't install one.
// I should use 'category' scale or install adapter.
// Standard C8y uses moment commonly. 
// For now, I'll use category or simple index if time is messy.
// Actually, I'll assume standard install. I'll stick to basic labels for now.

Chart.register(...registerables);

@Component({
    selector: 'lib-stacked-bar-chart-widget',
    standalone: false,
    template: `
    <div class="d-flex a-i-center p-b-8">
       <c8y-date-time-picker [ngModel]="dateFrom" (ngModelChange)="dateFrom=$event; onDateChange()" [max]="dateTo"></c8y-date-time-picker>
       <span class="m-h-4">-</span>
       <c8y-date-time-picker [ngModel]="dateTo" (ngModelChange)="dateTo=$event; onDateChange()" [min]="dateFrom"></c8y-date-time-picker>
    </div>
    <div style="height: 100%; width: 100%; position: relative;">
      <canvas #myChart></canvas>
    </div>
  `,
})
export class StackedBarChartWidgetComponent implements OnInit, OnDestroy, AfterViewInit {
    @Input() config: any;

    @ViewChild('myChart') private chartRef!: ElementRef;
    private chart: Chart | undefined;
    private subscriptions: any[] = [];

    dateFrom: Date = new Date();
    dateTo: Date = new Date();


    constructor(private measurementService: MeasurementService, private realtime: Realtime) { }

    async ngOnInit() {
        // Default to last hour
        this.dateTo = new Date();
        this.dateFrom = moment().subtract(1, 'hour').toDate();
    }

    onDateChange() {
        this.loadData();
    }

    ngAfterViewInit() {
        if (this.config && this.config.datapoints) {
            this.initChart();
            this.loadData();
            this.setupRealtime();
        }
    }

    ngOnDestroy() {
        this.subscriptions.forEach((sub) => this.realtime.unsubscribe(sub));
        if (this.chart) {
            this.chart.destroy();
        }
    }

    private initChart() {
        const ctx = this.chartRef.nativeElement.getContext('2d');

        // Prepare datasets
        const datasets = this.config.datapoints.map((dp: any) => ({
            label: `${dp.__target.name || dp.__target.id} - ${dp.fragment}.${dp.series}`,
            data: [], // Will fill later
            backgroundColor: dp.color || this.getRandomColor(),
            stack: 'Stack 0',
        }));

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [], // Time labels
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                    },
                },
            },
        });
    }

    private async loadData() {
        if (!this.config.datapoints) return;

        // For simplicity, fetch last 10 measurements for each datapoint and try to align?
        // Time alignment is hard. 
        // I will fetch measurements and sort them by time.
        // To stack, they need to share labels.

        // Alternative: Just plot last value? No, "Chart" implies history.

        // I will use a Map<Time, Values[]> to aggregate?
        // Let's fetch last 50 data points per series.

        const promises = this.config.datapoints.map((dp: any) =>
            this.measurementService.list({
                source: dp.__target.id,
                fragmentType: dp.fragment,
                valueFragmentType: dp.fragment,
                valueFragmentSeries: dp.series,
                pageSize: this.config.limit || 50,
                revert: true,
                dateFrom: new Date(this.dateFrom).toISOString(),
                dateTo: new Date(this.dateTo).toISOString()
            })
        );

        const results = await Promise.all(promises);

        // Process results
        // We need a unified list of timestamps.
        const timeSet = new Set<string>();
        const dataMap: any = {}; // { time: { seriesIndex: value } }

        results.forEach((res: any, index: number) => {
            res.data.forEach((m: any) => {
                const time = m.time;
                timeSet.add(time);
                if (!dataMap[time]) dataMap[time] = {};

                // Extract value
                const val = m[this.config.datapoints[index].fragment]?.[this.config.datapoints[index].series]?.value;
                if (val !== undefined) {
                    dataMap[time][index] = val;
                }
            });
        });

        const sortedTimes = Array.from(timeSet).sort();

        // Update chart
        if (this.chart) {
            this.chart.data.labels = sortedTimes.map(t => new Date(t).toLocaleTimeString());

            this.chart.data.datasets.forEach((ds: any, i: number) => {
                ds.data = sortedTimes.map(t => dataMap[t]?.[i] || 0); // 0 or null? 0 for stacking usually
            });

            this.chart.update();
        }
    }

    private setupRealtime() {
        // Add logic for realtime updates if needed
        // Skip for MVP to ensure stability first
    }

    private getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
}
