import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
	{
		path: 'login',
		title: 'BRANTAS | Portal Masuk Eksekutif',
		loadComponent: () => import('./features/auth/login-page/login-page').then((module) => module.LoginPageComponent)
	},
	{
		path: '',
		canActivate: [authGuard],
		loadComponent: () => import('./layout/app-shell/app-shell').then((module) => module.AppShellComponent),
		children: [
			{
				path: 'beranda',
				title: 'BRANTAS | Dashboard',
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
				redirectTo: 'beranda',
				pathMatch: 'full'
			},
			{
				path: 'laporan',
				title: 'BRANTAS | Rekomendasi Kebijakan & Metadata',
				loadComponent: () => import('./features/reporting/reporting-page/reporting-page').then((module) => module.ReportingPageComponent)
			},
			{ path: '', pathMatch: 'full', redirectTo: 'beranda' }
		]
	},
	{ path: '**', redirectTo: 'beranda' }
];

