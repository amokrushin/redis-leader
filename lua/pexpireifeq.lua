local key = KEYS[1]
local value = ARGV[1]
local milliseconds = ARGV[2]

if redis.call('get', key) == value then
    return redis.call('pexpire', key, milliseconds)
else
    return 0
end
