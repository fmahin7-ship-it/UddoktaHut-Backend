async function getZohoRefreshToken() {
  const params = new URLSearchParams({
    code: '1000.27669bc50fbf7cb3e7bf4e1f24d32168.eca718d0058fce28ac976efd84ef1d45',       
    client_id: '1000.I6ZNQQJB3BARTHKXYP5O8M5ZSAFFSC',          
    client_secret: 'f955c8d694d25d25e562dac8e74be40367a79e670e',   
    redirect_uri: "https://uddoktahut.com",     
    grant_type: "authorization_code",
  });

  try {
    const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        body: params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log("Refresh Token:", data);
  } catch (err) {
    console.error(
      "Error getting refresh token:",
      err instanceof Error ? err.message : err
    );
  }
}

getZohoRefreshToken();
