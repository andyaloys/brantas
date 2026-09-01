import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { SpatialMapComponent } from './pages/spatial-map/spatial-map';
import { OptimizerComponent } from './pages/optimizer/optimizer';
import { PolicyComponent } from './pages/policy/policy';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'spatial-map', component: SpatialMapComponent },
  { path: 'optimizer', component: OptimizerComponent },
  { path: 'policy', component: PolicyComponent }
];
