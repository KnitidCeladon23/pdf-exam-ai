#!/bin/bash

# SSL Setup Script for PDF Exam AI
# This script automates the SSL certificate setup using Let's Encrypt

set -e

echo "================================="
echo "PDF Exam AI - SSL Setup"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Get domain name from user
echo "📝 Enter your domain name (e.g., example.com):"
read -r DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name cannot be empty"
    exit 1
fi

echo ""
echo "🔍 Using domain: $DOMAIN"
echo ""

# Get email for Let's Encrypt
echo "📧 Enter your email for Let's Encrypt notifications:"
read -r EMAIL

if [ -z "$EMAIL" ]; then
    echo "❌ Email cannot be empty"
    exit 1
fi

echo ""
echo "================================="
echo "Installing Certbot..."
echo "================================="

# Install Certbot
apt-get update
apt-get install -y certbot

echo ""
echo "================================="
echo "Stopping nginx temporarily..."
echo "================================="

# Stop nginx to allow certbot standalone mode
cd /root/pdf-exam-ai
docker compose stop nginx

echo ""
echo "================================="
echo "Obtaining SSL certificate..."
echo "================================="

# Obtain certificate using standalone mode
certbot certonly --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -ne 0 ]; then
    echo "❌ Failed to obtain SSL certificate"
    echo "   Make sure:"
    echo "   1. Your domain's DNS A record points to this server"
    echo "   2. Ports 80 and 443 are open in firewall"
    echo "   3. Wait a few minutes for DNS to propagate"
    docker compose start nginx
    exit 1
fi

echo ""
echo "================================="
echo "Setting up SSL certificates..."
echo "================================="

# Create SSL directory
mkdir -p /root/pdf-exam-ai/ssl

# Copy certificates
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /root/pdf-exam-ai/ssl/cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /root/pdf-exam-ai/ssl/key.pem

# Set permissions
chmod 644 /root/pdf-exam-ai/ssl/cert.pem
chmod 600 /root/pdf-exam-ai/ssl/key.pem

echo ""
echo "================================="
echo "Updating nginx configuration..."
echo "================================="

# Update nginx.conf with domain
sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/g" /root/pdf-exam-ai/nginx-ssl.conf

echo ""
echo "================================="
echo "Setting up auto-renewal..."
echo "================================="

# Create renewal hook script
cat > /root/pdf-exam-ai/renew-ssl.sh << 'RENEWAL_SCRIPT'
#!/bin/bash
# SSL Certificate Renewal Hook

DOMAIN=$(ls /etc/letsencrypt/live/ | head -n 1)

if [ -n "$DOMAIN" ]; then
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /root/pdf-exam-ai/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /root/pdf-exam-ai/ssl/key.pem
    chmod 644 /root/pdf-exam-ai/ssl/cert.pem
    chmod 600 /root/pdf-exam-ai/ssl/key.pem
    
    cd /root/pdf-exam-ai
    docker compose restart nginx
    
    echo "✅ SSL certificates renewed and nginx restarted"
fi
RENEWAL_SCRIPT

chmod +x /root/pdf-exam-ai/renew-ssl.sh

# Add cron job for auto-renewal (runs twice daily)
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 0,12 * * * certbot renew --quiet --deploy-hook '/root/pdf-exam-ai/renew-ssl.sh'") | crontab -

echo ""
echo "================================="
echo "Restarting services with SSL..."
echo "================================="

# Update docker-compose to use SSL nginx config
cd /root/pdf-exam-ai
docker compose down nginx
docker compose up -d

echo ""
echo "✅ ================================="
echo "✅ SSL Setup Complete!"
echo "✅ ================================="
echo ""
echo "🌐 Your site is now available at:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo "📋 Next steps:"
echo "   1. Test your site: https://$DOMAIN"
echo "   2. Update your .env file with API keys if not done already"
echo "   3. Certificates will auto-renew every 90 days"
echo ""
echo "🔒 SSL Certificate Info:"
certbot certificates
echo ""
