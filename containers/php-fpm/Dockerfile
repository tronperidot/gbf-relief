FROM php:fpm
WORKDIR /var/www/html
RUN apt-get update && docker-php-ext-install mbstring mysqli pdo_mysql
ADD conf/php.ini /usr/local/etc/php/conf.d
ENV NODE_PATH /usr/local/lib/node_modules
