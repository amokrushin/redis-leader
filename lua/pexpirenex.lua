local key = KEYS[1]
local milliseconds = ARGV[1]

local pttl = redis.call('pttl', key)

if pttl == -1 then
    -- key exists but has no associated expire
    return redis.call('pexpire', key, milliseconds)
else
    -- key does not exist or has no associated expire
    return 0
end
