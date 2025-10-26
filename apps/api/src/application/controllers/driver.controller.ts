import type { Request, Response } from 'express';
import { DriverService } from '../../domain/driver-service';
import { DriverOrdersService } from '../../domain/driver-orders-service';
import { AuthService } from '../../domain/auth-service';

export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly driverOrdersService: DriverOrdersService,
    private readonly authService: AuthService
  ) {}

  login = async (req: Request, res: Response) => {
    try {
      const tokens = await this.driverService.login(req.body);
      res.json({ data: tokens });
    } catch (error: any) {
      res.status(401).json({ error: error.message ?? 'INVALID_CREDENTIALS' });
    }
  };

  profile = async (req: Request, res: Response) => {
    const user = (req as any).user as { sub: string; role: string } | undefined;
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    try {
      const driver = await this.driverService.getProfile(user.sub);
      res.json({ data: driver });
    } catch (error: any) {
      if (error instanceof Error && error.message === 'DRIVER_NOT_FOUND') {
        return res.status(404).json({ error: 'DRIVER_NOT_FOUND' });
      }
      res.status(500).json({ error: 'UNEXPECTED_ERROR' });
    }
  };

  listDrivers = async (_req: Request, res: Response) => {
    const drivers = await this.driverService.listDrivers();
    res.json({ data: drivers });
  };

  stats = async (_req: Request, res: Response) => {
    const data = await this.driverService.listDriverStats();
    res.json({ data });
  };

  listAvailableOrders = async (_req: Request, res: Response) => {
    const orders = await this.driverOrdersService.listAvailableOrders();
    res.json({ data: orders });
  };

  updateStatus = async (req: Request, res: Response) => {
    const driver = await this.driverService.updateStatus({
      driverId: req.params.id,
      status: req.body?.status
    });
    res.json({ data: driver });
  };

  updateLocation = async (req: Request, res: Response) => {
    const driver = await this.driverService.updateLocation({
      driverId: req.params.id,
      lat: req.body?.lat,
      lng: req.body?.lng
    });
    res.json({ data: driver });
  };
}
