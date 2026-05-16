declare module "smartcar" {
  interface SmartcarOptions {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    mode?: "simulated" | "live" | "test";
  }

  interface TokenSet {
    accessToken: string;
    refreshToken: string;
    expiration: Date;
    refreshExpiration: Date;
  }

  interface AuthUrlOptions {
    state?: string;
    scope?: string[];
    forcePrompt?: boolean;
  }

  interface VehicleList {
    vehicles: string[];
    paging: { count: number; offset: number };
  }

  interface BatteryData {
    percentRemaining: number;
    range: { value: number; unit: string };
  }

  interface OdometerData {
    distance: { value: number; unit: string };
  }

  interface LocationData {
    data: { latitude: number; longitude: number };
    age: string;
  }

  interface SpeedData {
    speed: { value: number; unit: string };
  }

  class Vehicle {
    constructor(vehicleId: string, accessToken: string);
    battery(): Promise<BatteryData>;
    odometer(): Promise<OdometerData>;
    location(): Promise<LocationData>;
    speed?(): Promise<SpeedData>;
  }

  class Smartcar {
    constructor(options: SmartcarOptions);
    getAuthUrl(options?: AuthUrlOptions): string;
    exchangeCode(code: string): Promise<TokenSet>;
    exchangeRefreshToken(refreshToken: string): Promise<TokenSet>;
    static getVehicles(accessToken: string): Promise<VehicleList>;
    static Vehicle: typeof Vehicle;
  }

  export = Smartcar;
}
