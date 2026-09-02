import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./layout/app-shell/app-shell').then((module) => module.AppShellComponent),
		children: [
			{
				path: 'beranda',
				title: 'BRANTAS | Beranda',
				loadComponent: () => import('./features/dashboard/dashboard-page/dashboard-page').then((module) => module.DashboardPageComponent)
			},
			{
				path: 'anomali',
				title: 'BRANTAS | Anomali Fiskal',
				loadComponent: () => import('./features/anomaly/anomaly-page/anomaly-page').then((module) => module.AnomalyPageComponent)
			},
			{
				path: 'peta-spasial',
				title: 'BRANTAS | Peta Spasial',
				loadComponent: () => import('./features/spatial/spatial-page/spatial-page').then((module) => module.SpatialPageComponent)
			},
			{
				path: 'simulasi-alokasi',
				title: 'BRANTAS | Simulasi Alokasi',
				loadComponent: () => import('./features/optimization/optimization-page/optimization-page').then((module) => module.OptimizationPageComponent)
			},
			{
				path: 'dampak',
				title: 'BRANTAS | Dampak Kebijakan',
				loadComponent: () => import('./features/causal/causal-page/causal-page').then((module) => module.CausalPageComponent)
			},
			{
				path: 'jusi',
				title: 'BRANTAS | JUSI',
				loadComponent: () => import('./features/jusi/jusi-page/jusi-page').then((module) => module.JusiPageComponent)
			},
			{
				path: 'laporan',
				title: 'BRANTAS | Pelaporan',
				loadComponent: () => import('./features/reporting/reporting-page/reporting-page').then((module) => module.ReportingPageComponent)
			},
			{ path: '', pathMatch: 'full', redirectTo: 'beranda' }
		]
	},
	{ path: '**', redirectTo: 'beranda' }
];
