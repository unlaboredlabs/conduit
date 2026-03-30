type VultrReservedIp = {
  id: string;
  region: string;
  ip: string;
};

const VULTR_API_URL = "https://api.vultr.com/v2";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${VULTR_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VULTR_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vultr API ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const createReservedIpv4 = async (region: string, label: string) => {
  const payload = await request<{ reserved_ip: VultrReservedIp }>(
    "/reserved-ips",
    {
      method: "POST",
      body: JSON.stringify({
        region,
        ip_type: "v4",
        label,
      }),
    },
  );

  return payload.reserved_ip;
};

export const attachReservedIpv4 = async (
  reservedIpId: string,
  instanceId: string,
) => {
  await request<void>(`/reserved-ips/${reservedIpId}/attach`, {
    method: "POST",
    body: JSON.stringify({
      instance_id: instanceId,
    }),
  });
};

export const deleteReservedIpv4 = async (reservedIpId: string) => {
  await request<void>(`/reserved-ips/${reservedIpId}`, {
    method: "DELETE",
  });
};
