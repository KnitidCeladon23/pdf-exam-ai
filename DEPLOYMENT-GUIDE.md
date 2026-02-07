# Domain and SSL Setup Guide

## Your Server Information
- **Server IP**: 64.176.80.52
- **Server Location**: Vultr

## Step-by-Step Guide

### Step 1: Purchase a Domain Name

Choose a domain registrar and purchase a domain:

**Recommended Registrars:**
- **Namecheap** (https://namecheap.com) - ~$10-15/year
- **Google Domains** (https://domains.google) - ~$12/year  
- **Cloudflare** (https://cloudflare.com) - At-cost pricing (~$8-10/year)
- **Porkbun** (https://porkbun.com) - Budget-friendly

**Tips:**
- Look for .com, .net, or .app domains
- Check for first-year discounts
- Enable domain privacy protection (usually free)

### Step 2: Configure DNS Records

After purchasing your domain, configure DNS to point to your server:

**Login to your domain registrar's DNS management panel and add:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 64.176.80.52 | 3600 |
| A | www | 64.176.80.52 | 3600 |

**Example for domain "myexamapp.com":**
```
A     @     64.176.80.52
A     www   64.176.80.52
```

**Note:** DNS propagation takes 5-60 minutes. You can check status at:
- https://dnschecker.org

### Step 3: Verify DNS Propagation

Wait for DNS to propagate, then verify:

```bash
# Check if your domain resolves to your server IP
nslookup yourdomain.com
dig yourdomain.com
```

The results should show: 64.176.80.52

### Step 4: Run SSL Setup Script

Once DNS is propagated, run the automated SSL setup:

```bash
cd /root/pdf-exam-ai
sudo ./setup-ssl.sh
```

**The script will:**
1. ✅ Install Certbot (Let's Encrypt client)
2. ✅ Obtain free SSL certificates
3. ✅ Configure nginx for HTTPS
4. ✅ Set up automatic certificate renewal
5. ✅ Restart services with SSL enabled

**You'll be asked for:**
- Your domain name (e.g., myexamapp.com)
- Your email address (for certificate expiration alerts)

### Step 5: Update Environment Variables (If Not Done)

Make sure your API keys are configured:

```bash
nano /root/pdf-exam-ai/.env
```

Add your OpenAI or Anthropic API keys:
```
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
AI_GATEWAY_API_KEY=...
```

Save with: Ctrl+X, then Y, then Enter

### Step 6: Access Your Site

After SSL setup completes, access your application at:
- https://yourdomain.com
- https://www.yourdomain.com

## Firewall Configuration

Make sure these ports are open in Vultr firewall:

```bash
# Check if firewall is active
sudo ufw status

# If active, allow necessary ports
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
```

## Troubleshooting

### Issue: "Failed to obtain SSL certificate"

**Solutions:**
1. Wait 10-15 minutes for DNS propagation
2. Verify DNS with: `nslookup yourdomain.com`
3. Check ports 80 & 443 are open
4. Make sure domain points to: 64.176.80.52

### Issue: "Connection refused" or "Site unreachable"

**Solutions:**
1. Check containers are running: `sudo docker compose ps`
2. Check nginx logs: `sudo docker compose logs nginx`
3. Restart services: `sudo docker compose restart`

### Issue: Certificate expiration

**Don't worry!** Certificates auto-renew every 90 days via cron job.

To manually renew:
```bash
sudo certbot renew
sudo /root/pdf-exam-ai/renew-ssl.sh
```

## Manual SSL Setup (Alternative)

If the automated script doesn't work, follow manual steps in the repository documentation.

## Useful Commands

```bash
# View all container logs
sudo docker compose logs -f

# Restart specific service
sudo docker compose restart nginx

# Check SSL certificate status
sudo certbot certificates

# Test SSL configuration
curl -I https://yourdomain.com
```

## Security Recommendations

1. ✅ Keep system updated: `sudo apt update && sudo apt upgrade`
2. ✅ Use strong .env passwords
3. ✅ Enable Vultr firewall in control panel
4. ✅ Regular backups of database
5. ✅ Monitor logs for suspicious activity

## Need Help?

- DNS not propagating? Try: https://dnschecker.org
- SSL issues? Check: https://www.ssllabs.com/ssltest/
- Firewall issues? Check Vultr control panel → Firewall tab
