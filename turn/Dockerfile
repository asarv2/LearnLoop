FROM coturn/coturn:4.6

COPY start.sh /usr/local/bin/start.sh

# Switch to root to modify the script's permissions
USER root

# Make the script executable.
# If you haven't already, ensure the script has Unix-style line endings
# by running "dos2unix realtime/start-turn.sh" on your host machine.
RUN chmod 755 /usr/local/bin/start.sh

# DO NOT add "USER turnserver" here.
# The container will start as root, and the turnserver application
# will handle its own user/privilege management.

ENTRYPOINT ["/usr/local/bin/start.sh"]