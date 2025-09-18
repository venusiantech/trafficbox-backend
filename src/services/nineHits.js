async function siteAdd(payload, idempotencyKey = null) {
  // idempotency: include a custom header or unique param
  const params = { key: KEY };
  if (idempotencyKey) params.idempotency = idempotencyKey;

  // ✅ enforce required flags
  const body = {
    ...payload,
    is_adult: payload.is_adult ?? false,
    is_coin_mining: payload.is_coin_mining ?? false,
  };

  const resp = await axios.post(`${BASE}/siteAdd`, body, { params });
  return resp.data;
}
