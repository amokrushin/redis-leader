#!/bin/sh

#
# copypaste from: https://github.com/redis/redis-rb/issues/350#issuecomment-108385007
#

until [ `docker exec redis redis-cli ping | grep -c PONG` = 1 ];
do echo "Waiting 1s for Redis to load";
    sleep 1;
done