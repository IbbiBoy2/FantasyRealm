FROM php:8.5.12-apache-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl-dev pkg-config unzip git \
    && docker-php-ext-install pdo_mysql \
    && pecl install mongodb \
    && docker-php-ext-enable mongodb \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
# Install the exact Composer dependency versions.
COPY Backend/composer.json Backend/composer.lock /var/www/html/FantasyRealm/Backend/
WORKDIR /var/www/html/FantasyRealm/Backend
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader

COPY Frontend /var/www/html/FantasyRealm/Frontend
COPY Backend/api /var/www/html/FantasyRealm/Backend/api
COPY Backend/config /var/www/html/FantasyRealm/Backend/config
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
RUN a2enmod headers rewrite && chown -R www-data:www-data /var/www/html/FantasyRealm
# Create the accessory upload directory with web server permissions.
RUN mkdir -p /var/www/html/FantasyRealm/Frontend/assets/accessories \
    && chown -R www-data:www-data /var/www/html/FantasyRealm/Frontend/assets/accessories

WORKDIR /var/www/html
EXPOSE 80
