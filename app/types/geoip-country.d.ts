declare module "geoip-country" {
  type GeoLookup = { country?: string } | null;
  const geoip: {
    lookup: (ip: string) => GeoLookup;
  };
  export default geoip;
}
